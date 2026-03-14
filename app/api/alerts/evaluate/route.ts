/* ── app/api/alerts/evaluate/route.ts ──────────────────────
   WindPing Alert Engine v3
   
   Schedule: Every 6 hours via Vercel Cron (00, 06, 12, 18 UTC)
   
   Alert types:
   - heads_up: days ahead, first time conditions match
   - go: evening before (≤1 day), confirmation
   - downgrade: conditions dropped below user range after heads_up/go
   
   Business logic lives in lib/services/:
   - weatherService.ts  — Open-Meteo + Stormglass
   - alertService.ts    — spot evaluation, types, date formatting
   - notificationService.ts — email + push
──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getForecast,
  getHourlyForecast,
  getHourlyForDay,
  getTideExtremes,
} from "@/lib/services/weatherService";
import {
  DAY_DB,
  evaluateSpot,
  buildDowngradeReasons,
  formatDateLabel,
  type SpotCondition,
  type SpotMatch,
  type AlertToSend,
} from "@/lib/services/alertService";
import {
  sendBundledEmail,
  sendAlertEmail,
} from "@/lib/services/notificationService";
import type {
  DbIdealConditions,
  HourlyWindData,
} from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const STORMGLASS_KEY = process.env.STORMGLASS_API_KEY || "";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ── Lokale interfaces ── */

interface WebPushError {
  statusCode?: number;
  message?: string;
  body?: string;
}

interface SpotRow {
  id: number;
  display_name: string;
  latitude: number;
  longitude: number;
  good_directions: string[] | null;
  spot_type?: string | null;
}

interface ConditionsPayload {
  spots: SpotMatch[];
  previousConditions?: Record<number, SpotCondition>;
  downgradeReasons?: Record<number, string[]>;
  tides?: Record<string, { time: string; type: string }[]>;
}

interface ResultItem {
  userId: number;
  email?: string;
  name?: string;
  alertType?: string;
  targetDate?: string;
  message?: string;
  spots?: SpotMatch[];
  notifyEmail?: boolean;
  notifyPush?: boolean;
  skipped?: string;
  evalLog?: string[];
  debugMeta?: Record<string, unknown>;
  debug?: DebugSpot[];
  _spotsRef?: SpotRow[];
  _prefs?: Record<string, unknown>;
  conditions?: ConditionsPayload;
}

interface DebugSpot {
  spot: string;
  date?: string;
  dayOfWeek?: string;
  available?: boolean;
  wind?: number;
  dir?: string;
  windOk?: boolean;
  dirOk?: boolean;
  inRange?: boolean;
  userWindMin?: number;
  userWindMax?: number;
  configuredDirs?: string[];
  error?: string;
}

/* ── MAIN HANDLER ── */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const body = await req.json().catch(() => ({}));
  const isTest = body.test === true;
  const testUserId = body.userId;

  if (!isTest && authHeader !== `Bearer ${CRON_SECRET}`) {
    let isAdmin = false;
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = JSON.parse(atob(token.split(".")[1]));
      const adminIds = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
      isAdmin = adminIds.includes(payload.sub);
    } catch {}
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const results: ResultItem[] = [];

  try {
    // 1. Get users with alert prefs
    let usersQuery = sb.from("users").select(`
      id, email, name, auth_id,
      alert_preferences!inner(
        lookahead_days, epic_any_day, alerts_paused_until,
        available_mon, available_tue, available_wed, available_thu, available_fri, available_sat, available_sun,
        notify_email, notify_push
      )
    `);

    if (testUserId) usersQuery = usersQuery.eq("id", testUserId);

    const { data: users, error: usersErr } = await usersQuery;
    if (usersErr) throw usersErr;
    if (!users?.length) return NextResponse.json({ message: "No users with alert prefs", results: [] });

    const globalTideCache: Record<string, { time: string; type: string }[]> = {};

    for (const user of users) {
      const prefs = Array.isArray(user.alert_preferences) ? user.alert_preferences[0] : user.alert_preferences;
      if (!prefs) continue;

      if (prefs.alerts_paused_until && new Date(prefs.alerts_paused_until) > now) {
        results.push({ userId: user.id, skipped: "paused" });
        continue;
      }

      // 2. Get user's spots + ideal conditions
      const { data: userSpots, error: usError } = await sb
        .from("user_spots").select("spot_id").eq("user_id", user.id);

      if (!userSpots?.length) {
        results.push({ userId: user.id, skipped: "no spots", debug_userSpots: userSpots, debug_usError: usError?.message } as ResultItem & Record<string, unknown>);
        continue;
      }
      const spotIds = (userSpots as { spot_id: number }[]).map(x => x.spot_id);

      const [{ data: spots, error: spError }, { data: conditions }] = await Promise.all([
        sb.from("spots").select("id, display_name, latitude, longitude, good_directions").in("id", spotIds),
        sb.from("ideal_conditions").select("*").eq("user_id", user.id).in("spot_id", spotIds),
      ]);

      if (!spots?.length) {
        results.push({ userId: user.id, skipped: "no spots data", debug_spotIds: spotIds, debug_spError: spError?.message } as ResultItem & Record<string, unknown>);
        continue;
      }

      const condsMap: Record<number, DbIdealConditions> = {};
      (conditions as DbIdealConditions[] || []).forEach(c => { condsMap[c.spot_id] = c; });

      // 3. Get existing alerts for dedup + snapshot comparison
      const { data: existingAlerts } = await sb
        .from("alert_history")
        .select("alert_type, target_date, spot_ids, conditions, primary_spot_id")
        .eq("user_id", user.id)
        .gte("target_date", today)
        .eq("is_test", false)
        .order("created_at", { ascending: false });

      const lookahead = prefs.lookahead_days || 3;
      const alertsToSend: AlertToSend[] = [];
      const evalLog: string[] = [];

      // 4. For each day in lookahead window
      for (let d = 0; d <= lookahead; d++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + d);
        const dateStr = targetDate.toISOString().split("T")[0];
        const dayOfWeek = targetDate.getDay();
        const isAvailable = prefs[DAY_DB[dayOfWeek]];
        const isTomorrowOrToday = d <= 1;

        if (!isAvailable && !prefs.epic_any_day) continue;

        interface ExistingAlert {
          alert_type: string;
          target_date: string;
          spot_ids: number[];
          conditions: { spots: { spotId: number; spotName: string; wind: number; gust: number; dir: string; dirDeg: number }[]; downgradeReasons?: Record<number, string[]> } | null;
          primary_spot_id: number | null;
        }
        const prevAlerts = ((existingAlerts as ExistingAlert[]) || []).filter(a => a.target_date === dateStr);
        const hadHeadsUp = prevAlerts.some(a => a.alert_type === "heads_up");
        const hadGo = prevAlerts.some(a => a.alert_type === "go");
        const hadDowngrade = prevAlerts.some(a => a.alert_type === "downgrade");

        const prevPositive = prevAlerts.find(a => a.alert_type === "go" || a.alert_type === "heads_up");
        const prevConditions: Record<number, SpotCondition> = {};
        if (prevPositive?.conditions?.spots) {
          for (const s of prevPositive.conditions.spots) {
            prevConditions[s.spotId] = s;
          }
        }

        const spotResults: SpotMatch[] = [];
        const spotErrors: { spot: string; err: string }[] = [];
        for (const spot of spots as SpotRow[]) {
          if (!spot.latitude || !spot.longitude) {
            spotErrors.push({ spot: spot.display_name, err: "no coords" });
            continue;
          }
          try {
            const forecast = await getForecast(spot.latitude, spot.longitude, lookahead + 1);
            spotResults.push(evaluateSpot(forecast, d, spot, condsMap[spot.id]));
          } catch (e) {
            spotErrors.push({ spot: spot.display_name, err: getErrorMessage(e) });
          }
        }

        if (!spotResults.length) {
          if (spotErrors.length) console.log(`Day ${d} (${dateStr}): no results, errors:`, JSON.stringify(spotErrors));
          continue;
        }

        const goSpots = spotResults.filter(s => s.inRange);
        const noGoSpots = spotResults.filter(s => !s.inRange);

        console.log(`Day ${d} (${dateStr}): ${spotResults.length} spots evaluated, ${goSpots.length} go, available=${isAvailable}, isTomorrowOrToday=${isTomorrowOrToday}, hadGo=${hadGo}, hadHeadsUp=${hadHeadsUp}`);
        evalLog.push(`d${d} ${dateStr} (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][targetDate.getDay()]}): ${goSpots.length}/${spotResults.length} go, avail=${isAvailable}, tmrw/today=${isTomorrowOrToday}, hadGo=${hadGo}, hadHU=${hadHeadsUp}`);

        if (goSpots.length > 0 && isAvailable) {
          if (isTomorrowOrToday && !hadGo) {
            const enriched = goSpots.map(s => {
              const prev = prevConditions[s.spotId];
              if (prev && (prev.wind !== s.wind || prev.dir !== s.dir)) {
                return { ...s, changed: true, prevWind: prev.wind, prevDir: prev.dir };
              }
              return s;
            });
            alertsToSend.push({ type: "go", targetDate: dateStr, spots: enriched });
          } else if (!isTomorrowOrToday && !hadHeadsUp) {
            alertsToSend.push({ type: "heads_up", targetDate: dateStr, spots: goSpots });
          }
        }

        if ((hadHeadsUp || hadGo) && !hadDowngrade) {
          const downgradedSpots: SpotMatch[] = [];
          const downgradeReasons: Record<number, string[]> = {};

          for (const spot of noGoSpots) {
            const prev = prevConditions[spot.spotId];
            if (prev) {
              downgradedSpots.push(spot);
              downgradeReasons[spot.spotId] = buildDowngradeReasons(spot, prev);
            }
          }

          if (downgradedSpots.length > 0) {
            alertsToSend.push({
              type: "downgrade",
              targetDate: dateStr,
              spots: downgradedSpots,
              previousConditions: prevConditions,
              downgradeReasons,
            });
          }
        }
      }

      // 5. Save alerts + build messages
      for (const alert of alertsToSend) {
        const spotData = alert.spots.map(s => ({
          spotId: s.spotId, spotName: s.spotName,
          wind: s.wind, gust: s.gust, dir: s.dir, dirDeg: s.dirDeg,
          inRange: s.inRange, userWindMin: s.userWindMin, userWindMax: s.userWindMax,
          ...(s.changed ? { changed: true, prevWind: s.prevWind, prevDir: s.prevDir } : {}),
        }));

        const conditionsPayload: ConditionsPayload = { spots: spotData as SpotMatch[] };
        if (alert.type === "downgrade") {
          conditionsPayload.previousConditions = alert.previousConditions;
          conditionsPayload.downgradeReasons = alert.downgradeReasons;
        }

        const { error: insertErr } = await sb.from("alert_history").insert({
          user_id: user.id,
          alert_type: alert.type,
          target_date: alert.targetDate,
          spot_ids: alert.spots.map(s => s.spotId),
          primary_spot_id: alert.spots[0]?.spotId,
          conditions: conditionsPayload,
          is_test: isTest,
        });

        if (insertErr) { console.error("Insert error:", insertErr); continue; }

        let message = "";
        const dateLabel = formatDateLabel(alert.targetDate);

        if (alert.type === "heads_up") {
          message = `📢 ${dateLabel} ziet er goed uit!\n` +
            alert.spots.map(s => `  ${s.spotName}: ${s.wind}kn ${s.dir}`).join("\n");
        } else if (alert.type === "go") {
          message = `✅ Morgen is Go!\n` +
            alert.spots.map(s => {
              let line = `  ${s.spotName}: ${s.wind}kn ${s.dir}`;
              if (s.changed) {
                const parts: string[] = [];
                if (s.prevWind !== s.wind) parts.push(`wind ${s.prevWind}→${s.wind}kn`);
                if (s.prevDir !== s.dir) parts.push(`richting ${s.prevDir}→${s.dir}`);
                if (parts.length) line += ` (${parts.join(", ")}, nog in range)`;
              }
              return line;
            }).join("\n");
        } else if (alert.type === "downgrade") {
          message = `⬇️ Forecast verslechterd voor ${dateLabel}\n` +
            alert.spots.map(s => {
              const r = alert.downgradeReasons?.[s.spotId] || [];
              return `  ${s.spotName}:\n${r.map(x => `    ${x}`).join("\n")}`;
            }).join("\n");
        }

        results.push({
          userId: user.id, email: user.email, name: user.name,
          alertType: alert.type, targetDate: alert.targetDate,
          message, spots: spotData as SpotMatch[],
          notifyEmail: prefs.notify_email, notifyPush: prefs.notify_push,
          _spotsRef: spots as SpotRow[], _prefs: prefs,
          conditions: conditionsPayload,
        });
      }

      if (!alertsToSend.length) {
        const debugSpots: DebugSpot[] = [];
        const debugMeta = { spotCount: spots?.length || 0, spotIds, lookahead: prefs.lookahead_days || 3 };

        for (const spot of spots as SpotRow[] || []) {
          if (!spot.latitude || !spot.longitude) {
            debugSpots.push({ spot: spot.display_name, error: "no coordinates" });
            continue;
          }
          try {
            const forecast = await getForecast(spot.latitude, spot.longitude, (prefs.lookahead_days || 3) + 1);
            for (let d = 0; d <= (prefs.lookahead_days || 3); d++) {
              const targetDate = new Date(now);
              targetDate.setDate(targetDate.getDate() + d);
              const dateStr = targetDate.toISOString().split("T")[0];
              const dayOfWeek = targetDate.getDay();
              const isAvailable = prefs[DAY_DB[dayOfWeek]];
              const result = evaluateSpot(forecast, d, spot, condsMap[spot.id]);
              debugSpots.push({
                spot: spot.display_name, date: dateStr,
                dayOfWeek: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek],
                available: isAvailable,
                wind: result.wind, dir: result.dir,
                windOk: result.windOk, dirOk: result.dirOk, inRange: result.inRange,
                userWindMin: result.userWindMin, userWindMax: result.userWindMax,
                configuredDirs: condsMap[spot.id]?.directions as string[] || [],
              });
            }
          } catch (e) {
            debugSpots.push({ spot: spot.display_name, error: getErrorMessage(e) });
          }
        }
        results.push({ userId: user.id, skipped: "no matching conditions", debugMeta, evalLog, debug: debugSpots });
      }
    }

    // 6. Send bundled emails + push for non-test alerts
    if (!isTest) {
      const byUser: Record<number, ResultItem[]> = {};
      for (const r of results) {
        if (!r.alertType) continue;
        if (!byUser[r.userId]) byUser[r.userId] = [];
        byUser[r.userId].push(r);
      }

      for (const [uid, userResults] of Object.entries(byUser)) {
        const first = userResults[0];
        const goAlerts = userResults.filter(r => r.alertType === "go" || r.alertType === "heads_up");
        const downgradeAlerts = userResults.filter(r => r.alertType === "downgrade");

        // Tides ophalen voor zee-spots
        if (goAlerts.length > 0) {
          const spotsRef = (first._spotsRef || []) as SpotRow[];
          for (const alert of goAlerts) {
            for (const s of alert.spots || []) {
              const spot = spotsRef.find(sp => sp.id === s.spotId);
              if (spot?.latitude && spot?.longitude && spot?.spot_type?.toLowerCase() === "zee") {
                const key = `${s.spotId}_${alert.targetDate}`;
                if (!globalTideCache[key]) {
                  try {
                    globalTideCache[key] = await getTideExtremes(spot.latitude, spot.longitude, alert.targetDate!, STORMGLASS_KEY);
                  } catch {}
                }
              }
            }
          }

          // Tides opslaan in alert_history
          for (const alert of goAlerts) {
            const tidesForAlert: Record<string, { time: string; type: string }[]> = {};
            for (const s of alert.spots || []) {
              const key = `${s.spotId}_${alert.targetDate}`;
              if (globalTideCache[key]?.length) tidesForAlert[s.spotId] = globalTideCache[key];
            }
            if (Object.keys(tidesForAlert).length > 0) {
              await sb.from("alert_history")
                .update({ conditions: { ...alert.conditions, tides: tidesForAlert } })
                .eq("user_id", Number(uid))
                .eq("target_date", alert.targetDate)
                .eq("alert_type", alert.alertType)
                .order("created_at", { ascending: false })
                .limit(1);
            }
          }
        }

        // Bundled go/heads_up email
        if (goAlerts.length > 0 && first.notifyEmail && first.email) {
          try {
            const hourlyBySpotDate: Record<string, HourlyWindData[]> = {};
            const spotsRef = (first._spotsRef || []) as SpotRow[];
            const userPrefs = first._prefs || {};

            for (const alert of goAlerts) {
              for (const s of alert.spots || []) {
                const spot = spotsRef.find(sp => sp.id === s.spotId);
                if (spot?.latitude && spot?.longitude) {
                  const key = `${s.spotId}_${alert.targetDate}`;
                  if (!hourlyBySpotDate[key]) {
                    try {
                      const hourly = await getHourlyForecast(spot.latitude, spot.longitude, ((userPrefs.lookahead_days as number) || 3) + 1);
                      hourlyBySpotDate[key] = getHourlyForDay(hourly, alert.targetDate!);
                    } catch {}
                  }
                }
              }
            }

            await sendBundledEmail(
              first.email, first.name ?? null, Number(uid),
              goAlerts.map(a => ({ targetDate: a.targetDate!, spots: a.spots!, alertType: a.alertType! as "go" | "heads_up" | "downgrade" })),
              hourlyBySpotDate,
              globalTideCache
            );

            for (const alert of goAlerts) {
              await sb.from("alert_history")
                .update({ delivered_email: true })
                .eq("user_id", Number(uid))
                .eq("target_date", alert.targetDate)
                .eq("alert_type", alert.alertType)
                .order("created_at", { ascending: false })
                .limit(1);
            }
          } catch (e) { console.error("Bundled email error:", e); }
        }

        // Downgrade emails
        for (const alert of downgradeAlerts) {
          if (first.notifyEmail && first.email) {
            try {
              await sendAlertEmail(first.email, first.name ?? null, alert.alertType! as "go" | "heads_up" | "downgrade", alert.message!, alert.spots!, alert.targetDate!);
              await sb.from("alert_history")
                .update({ delivered_email: true })
                .eq("user_id", Number(uid))
                .eq("target_date", alert.targetDate)
                .eq("alert_type", alert.alertType)
                .order("created_at", { ascending: false })
                .limit(1);
            } catch (e) { console.error("Downgrade email error:", e); }
          }
        }

        // Push notifications
        if (first.notifyPush) {
          try {
            const webpush = await import("web-push");
            webpush.setVapidDetails(
              "mailto:alerts@windping.com",
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
              process.env.VAPID_PRIVATE_KEY || ""
            );

            const { data: subs } = await sb
              .from("push_subscriptions")
              .select("endpoint, keys_p256dh, keys_auth")
              .eq("user_id", Number(uid));

            if (subs?.length) {
              const dayLabels = goAlerts.map(a => formatDateLabel(a.targetDate!));
              const allSpots = userResults.flatMap(a => (a.spots || []));
              const uniqueSpots = [...new Map(allSpots.map(s => [s.spotId, s])).values()];

              const pushTitle = goAlerts.length > 0
                ? `✅ ${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go!`
                : downgradeAlerts.length > 0 ? `⬇️ Forecast verslechterd` : "WindPing Alert";

              const pushBody = uniqueSpots
                .map(s => `${s.spotName}: ${s.wind}kn ${s.dir}`)
                .join(" · ");

              const payload = JSON.stringify({ title: pushTitle, body: pushBody, url: "/alert" });

              let pushSent = false;
              for (const sub of subs) {
                try {
                  await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
                    payload,
                    { TTL: 86400 }
                  );
                  pushSent = true;
                } catch (pe) {
                  const err = pe as WebPushError;
                  console.error("Push send error:", err.statusCode || getErrorMessage(pe));
                  if (err.statusCode === 404 || err.statusCode === 410) {
                    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
                  }
                }
              }

              if (pushSent) {
                for (const r of userResults) {
                  await sb.from("alert_history")
                    .update({ delivered_push: true })
                    .eq("user_id", Number(uid))
                    .eq("target_date", r.targetDate)
                    .eq("alert_type", r.alertType)
                    .order("created_at", { ascending: false })
                    .limit(1);
                }
              }
            }
          } catch (e) { console.error("Push error:", e); }
        }
      }
    }

    const alertsSent = results.filter(r => r.alertType).length;

    try {
      await sb.from("engine_runs").insert({
        alerts_sent: alertsSent,
        duration_ms: Date.now() - startTime,
        source: "cron",
      });
    } catch (e) { console.error("Heartbeat save error:", e); }

    return NextResponse.json({
      timestamp: now.toISOString(),
      usersEvaluated: users.length,
      alertsGenerated: alertsSent,
      results,
    });

  } catch (err) {
    console.error("Alert engine error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/* ── GET: health check + cron trigger ── */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";

  if (authHeader === `Bearer ${CRON_SECRET}` && CRON_SECRET) {
    const fakeReq = new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: authHeader },
      body: JSON.stringify({}),
    });
    return POST(fakeReq);
  }

  return NextResponse.json({ status: "ok", engine: "alerts/evaluate/v3", timestamp: new Date().toISOString() });
}