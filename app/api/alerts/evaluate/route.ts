/* ── app/api/alerts/evaluate/route.ts ──────────────────────
   WindPing Alert Engine v3
   
   Schedule: Every 6 hours via Vercel Cron (00, 06, 12, 18 UTC)
   
   Alert types:
   - heads_up: days ahead, first time conditions match
   - go: evening before (≤1 day), confirmation
   - downgrade: conditions dropped below user range after heads_up/go
     → includes comparison with previous snapshot
     → includes "I'm going anyway" option
   
   Rules:
   - No "maybe" — either Go or silence
   - Dedup: 1 heads_up, 1 go, 1 downgrade per spot per target date
   - Bundle: multiple spots in 1 alert per user per day
   - Snapshots: store conditions with each alert for comparison
   
   v3 changes:
   - Light theme emails
   - Tide data (HW/LW) in emails via Stormglass
   - Enriched push notification body with wind + spot details
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const STORMGLASS_KEY = process.env.STORMGLASS_API_KEY || "";
const OM_BASE = "https://api.open-meteo.com/v1/forecast";
const OM_HOURLY_CACHE = new Map<string, any>();
const TIDE_CACHE = new Map<string, any>();

async function getHourlyForecast(lat: number, lng: number, days: number) {
  const key = `hourly_${lat.toFixed(3)},${lng.toFixed(3)},${days}`;
  if (OM_HOURLY_CACHE.has(key)) return OM_HOURLY_CACHE.get(key);
  
  const url = `${OM_BASE}?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo hourly ${res.status}`);
  const data = await res.json();
  OM_HOURLY_CACHE.set(key, data);
  return data;
}

function getHourlyForDay(hourlyData: any, dateStr: string): { hour: number; wind: number; gust: number; dir: string }[] {
  if (!hourlyData?.hourly?.time) return [];
  const times: string[] = hourlyData.hourly.time;
  const winds: number[] = hourlyData.hourly.wind_speed_10m;
  const gusts: number[] = hourlyData.hourly.wind_gusts_10m;
  const dirs: number[] = hourlyData.hourly.wind_direction_10m;
  
  const hours = [6, 9, 12, 15, 18];
  const result: { hour: number; wind: number; gust: number; dir: string }[] = [];
  
  for (const h of hours) {
    const target = `${dateStr}T${h.toString().padStart(2, "0")}:00`;
    const idx = times.indexOf(target);
    if (idx >= 0) {
      result.push({
        hour: h,
        wind: Math.round(winds[idx] || 0),
        gust: Math.round(gusts[idx] || 0),
        dir: degToDir(dirs[idx] || 0),
      });
    }
  }
  return result;
}

/* ── Tide helpers ── */
async function getTideExtremes(lat: number, lng: number, dateStr: string): Promise<{ time: string; type: string }[]> {
  if (!STORMGLASS_KEY) return [];
  const key = `tide_${lat.toFixed(2)},${lng.toFixed(2)}`;
  
  let allExtremes: any[] = [];
  if (TIDE_CACHE.has(key)) {
    allExtremes = TIDE_CACHE.get(key);
  } else {
    try {
      const start = new Date(dateStr + "T00:00:00Z");
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const url = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${start.toISOString()}&end=${end.toISOString()}`;
      const res = await fetch(url, { headers: { Authorization: STORMGLASS_KEY } });
      if (!res.ok) return [];
      const data = await res.json();
      allExtremes = data.data || [];
      TIDE_CACHE.set(key, allExtremes);
    } catch { return []; }
  }
  
  // Filter extremes for the target date, Amsterdam timezone
  return allExtremes
    .filter((e: any) => {
      const d = new Date(e.time);
      const nl = d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
      return nl === dateStr;
    })
    .map((e: any) => {
      const d = new Date(e.time);
      const timeStr = d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
      return { time: timeStr, type: e.type === "high" ? "HW" : "LW" };
    });
}

const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToDir(deg: number) { return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
function dirIndex(deg: number) { return Math.round(((deg % 360 + 360) % 360) / 22.5) % 16; }

const DAY_DB = ["available_sun", "available_mon", "available_tue", "available_wed", "available_thu", "available_fri", "available_sat"] as const;

/* ── Types ── */
interface SpotCondition {
  spotId: number;
  spotName: string;
  wind: number;
  gust: number;
  dir: string;
  dirDeg: number;
}

interface SpotMatch extends SpotCondition {
  inRange: boolean;
  windOk: boolean;
  dirOk: boolean;
  userWindMin: number;
  userWindMax: number;
  changed?: boolean;
  prevWind?: number;
  prevDir?: string;
}

interface AlertToSend {
  type: "heads_up" | "go" | "downgrade";
  targetDate: string;
  spots: SpotMatch[];
  previousConditions?: Record<number, SpotCondition>;
  downgradeReasons?: Record<number, string[]>;
}

/* ── Forecast cache (per request) ── */
const forecastCache = new Map<string, any>();

async function getForecast(lat: number, lng: number, days: number) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${days}`;
  if (forecastCache.has(key)) return forecastCache.get(key);
  
  const url = `${OM_BASE}?latitude=${lat}&longitude=${lng}&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=auto&forecast_days=${days}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Open-Meteo ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  forecastCache.set(key, data);
  return data;
}

/* ── Evaluate one spot ── */
function evaluateSpot(forecast: any, dayIndex: number, spot: any, ic: any): SpotMatch {
  const wind = Math.round(forecast.daily.wind_speed_10m_max[dayIndex] || 0);
  const gust = Math.round(forecast.daily.wind_gusts_10m_max[dayIndex] || 0);
  const dirDeg = forecast.daily.wind_direction_10m_dominant[dayIndex] || 0;
  const dir = degToDir(dirDeg);
  
  const wMin = ic?.wind_min ?? 12;
  const wMax = ic?.wind_max ?? 35;
  
  const rawDirs = ic?.directions?.length ? ic.directions : (spot.good_directions || []);
  let dirOk = true;
  if (rawDirs.length > 0) {
    if (typeof rawDirs[0] === "string") {
      dirOk = rawDirs.includes(dir);
    } else {
      const dIdx = dirIndex(dirDeg);
      dirOk = rawDirs[dIdx] === true;
    }
  }
  
  const windOk = wind >= wMin && wind <= wMax;
  
  return {
    spotId: spot.id,
    spotName: spot.display_name,
    wind, gust, dir, dirDeg,
    inRange: windOk && dirOk,
    windOk, dirOk,
    userWindMin: wMin,
    userWindMax: wMax,
  };
}

/* ── Build downgrade reasons ── */
function buildDowngradeReasons(current: SpotMatch, previous: SpotCondition): string[] {
  const reasons: string[] = [];
  if (!current.windOk) {
    if (current.wind < current.userWindMin) {
      reasons.push(`Wind: ${previous.wind}kn → ${current.wind}kn (minimum: ${current.userWindMin}kn)`);
    } else if (current.wind > current.userWindMax) {
      reasons.push(`Wind: ${previous.wind}kn → ${current.wind}kn (maximum: ${current.userWindMax}kn)`);
    }
  }
  if (!current.dirOk) {
    reasons.push(`Richting: ${previous.dir} → ${current.dir} (niet in je instellingen)`);
  }
  return reasons;
}

/* ── Date formatting ── */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
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
  const results: any[] = [];
  
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
    
    // Globale tide cache — gedeeld over alle gebruikers zodat Kijkduin maar 1x wordt opgehaald
    const globalTideCache: Record<string, { time: string; type: string; height?: number }[]> = {};

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
        results.push({ userId: user.id, skipped: "no spots", debug_userSpots: userSpots, debug_usError: usError?.message });
        continue;
      }
      const spotIds = userSpots.map((x: any) => x.spot_id);
      
      const [{ data: spots, error: spError }, { data: conditions }] = await Promise.all([
        sb.from("spots").select("id, display_name, latitude, longitude, good_directions").in("id", spotIds),
        sb.from("ideal_conditions").select("*").eq("user_id", user.id).in("spot_id", spotIds),
      ]);
      
      if (!spots?.length) {
        results.push({ userId: user.id, skipped: "no spots data", debug_spotIds: spotIds, debug_spError: spError?.message });
        continue;
      }
      
      const condsMap: Record<number, any> = {};
      (conditions || []).forEach((c: any) => { condsMap[c.spot_id] = c; });
      
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
        
        const prevAlerts = (existingAlerts || []).filter((a: any) => a.target_date === dateStr);
        const hadHeadsUp = prevAlerts.some((a: any) => a.alert_type === "heads_up");
        const hadGo = prevAlerts.some((a: any) => a.alert_type === "go");
        const hadDowngrade = prevAlerts.some((a: any) => a.alert_type === "downgrade");
        
        const prevPositive = prevAlerts.find((a: any) => a.alert_type === "go" || a.alert_type === "heads_up");
        const prevConditions: Record<number, SpotCondition> = {};
        if (prevPositive?.conditions?.spots) {
          for (const s of prevPositive.conditions.spots) {
            prevConditions[s.spotId] = s;
          }
        }
        
        const spotResults: SpotMatch[] = [];
        const spotErrors: any[] = [];
        for (const spot of spots) {
          if (!spot.latitude || !spot.longitude) { spotErrors.push({ spot: spot.display_name, err: "no coords" }); continue; }
          try {
            const forecast = await getForecast(spot.latitude, spot.longitude, lookahead + 1);
            spotResults.push(evaluateSpot(forecast, d, spot, condsMap[spot.id]));
          } catch (e: any) { spotErrors.push({ spot: spot.display_name, err: e.message }); }
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
              type: "downgrade", targetDate: dateStr,
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
        
        const conditionsPayload: any = { spots: spotData };
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
          message, spots: spotData,
          notifyEmail: prefs.notify_email, notifyPush: prefs.notify_push,
          _spotsRef: spots, _prefs: prefs,
        });
      }
      
      if (!alertsToSend.length) {
        const debugSpots: any[] = [];
        const debugMeta = { spotCount: spots?.length || 0, spotIds: spotIds, lookahead: prefs.lookahead_days || 3 };
        
        for (const spot of spots || []) {
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
                spot: spot.display_name,
                date: dateStr,
                dayOfWeek: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek],
                available: isAvailable,
                wind: result.wind, dir: result.dir,
                windOk: result.windOk, dirOk: result.dirOk, inRange: result.inRange,
                userWindMin: result.userWindMin, userWindMax: result.userWindMax,
                configuredDirs: condsMap[spot.id]?.directions || [],
              });
            }
          } catch (e: any) {
            debugSpots.push({ spot: spot.display_name, error: e.message });
          }
        }
        results.push({ userId: user.id, skipped: "no matching conditions", debugMeta, evalLog, debug: debugSpots });
      }
    }
    
    // 6. Send bundled emails + push for non-test alerts
    if (!isTest) {
      const byUser: Record<number, any[]> = {};
      for (const r of results) {
        if (!r.alertType) continue;
        if (!byUser[r.userId]) byUser[r.userId] = [];
        byUser[r.userId].push(r);
      }
      
      for (const [uid, userResults] of Object.entries(byUser)) {
        const first = userResults[0];
        
        const goAlerts = userResults.filter(r => r.alertType === "go" || r.alertType === "heads_up");
        const downgradeAlerts = userResults.filter(r => r.alertType === "downgrade");

        // Haal getijden op voor alle go-alerts en sla op in conditions (ongeacht email)
        // Gebruikt globalTideCache zodat dezelfde spot niet meerdere keren wordt opgevraagd
        if (goAlerts.length > 0) {
          const spotsRef = first._spotsRef || [];
          for (const alert of goAlerts) {
            for (const s of alert.spots || []) {
              const spot = spotsRef.find((sp: any) => sp.id === s.spotId);
              if (spot?.latitude && spot?.longitude && spot?.spot_type?.toLowerCase() === "zee") {
                const key = `${s.spotId}_${alert.targetDate}`;
                if (!globalTideCache[key]) {
                  try {
                    globalTideCache[key] = await getTideExtremes(spot.latitude, spot.longitude, alert.targetDate);
                  } catch {}
                }
              }
            }
          }
          const tideBySpotDate = globalTideCache;
          // Sla getijden op in alert_history.conditions
          for (const alert of goAlerts) {
            const tidesForAlert: Record<string, any[]> = {};
            for (const s of alert.spots || []) {
              const key = `${s.spotId}_${alert.targetDate}`;
              if (tideBySpotDate[key]?.length) tidesForAlert[s.spotId] = tideBySpotDate[key];
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

        // Send ONE bundled Go/heads_up email with hourly forecasts + tides
        if (goAlerts.length > 0 && first.notifyEmail && first.email) {
          try {
            const hourlyBySpotDate: Record<string, any[]> = {};
            const spotsRef = first._spotsRef || [];
            const userPrefs = first._prefs || {};
            
            for (const alert of goAlerts) {
              for (const s of alert.spots || []) {
                const spot = spotsRef.find((sp: any) => sp.id === s.spotId);
                if (spot?.latitude && spot?.longitude) {
                  const key = `${s.spotId}_${alert.targetDate}`;
                  if (!hourlyBySpotDate[key]) {
                    try {
                      const hourly = await getHourlyForecast(spot.latitude, spot.longitude, (userPrefs.lookahead_days || 3) + 1);
                      hourlyBySpotDate[key] = getHourlyForDay(hourly, alert.targetDate);
                    } catch {}
                  }
                }
              }
            }
            
            await sendBundledEmail(
              first.email, first.name, Number(uid),
              goAlerts.map(a => ({ targetDate: a.targetDate, spots: a.spots, alertType: a.alertType })),
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
        
        // Downgrade emails sent separately
        for (const alert of downgradeAlerts) {
          if (first.notifyEmail && first.email) {
            try {
              await sendAlertEmail(first.email, first.name, alert.alertType, alert.message, alert.spots, alert.targetDate);
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
        
        // Push notification — enriched body with wind details
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
              const dayLabels = goAlerts.map(a => formatDateLabel(a.targetDate));
              const allSpots = userResults.flatMap(a => (a.spots || []));
              const uniqueSpots = [...new Map(allSpots.map((s: any) => [s.spotId, s])).values()];
              
              const pushTitle = goAlerts.length > 0
                ? `✅ ${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go!`
                : downgradeAlerts.length > 0
                ? `⬇️ Forecast verslechterd`
                : "WindPing Alert";
              
              // Enriched body: spot name + wind + direction
              const pushBody = uniqueSpots
                .map((s: any) => `${s.spotName}: ${s.wind}kn ${s.dir}`)
                .join(" · ");
              
              const payload = JSON.stringify({
                title: pushTitle,
                body: pushBody,
                url: "/alert",
              });
              
              let pushSent = false;
              for (const sub of subs) {
                try {
                  await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
                    payload,
                    { TTL: 86400 }
                  );
                  pushSent = true;
                } catch (pe: any) {
                  console.error("Push send error:", pe.statusCode || pe.message);
                  if (pe.statusCode === 404 || pe.statusCode === 410) {
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
    
    // Save heartbeat to engine_runs
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
    
  } catch (err: any) {
    console.error("Alert engine error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── Token for "Ik ga!" email links ── */
function generateGoToken(userId: number, spotId: number, date: string): string {
  const secret = process.env.CRON_SECRET || "windping-secret";
  const raw = `${userId}-${spotId}-${date}-${secret}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* ── Bundled Go/heads_up email — LIGHT THEME + tides ── */
async function sendBundledEmail(
  to: string, name: string | null, userId: number,
  days: { targetDate: string; spots: any[]; alertType: string }[],
  hourlyBySpotDate: Record<string, any[]>,
  tideBySpotDate: Record<string, { time: string; type: string }[]>
) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  
  const greeting = name ? `Hey ${name}` : "Hey";
  const dayLabels = days.map(d => formatDateLabel(d.targetDate));
  
  const subject = `✅ ${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go!`;
  
  const daySections = days.map(day => {
    const dateLabel = formatDateLabel(day.targetDate);
    
    const spotRows = day.spots.map(s => {
      let extra = "";
      if (s.changed) {
        const parts: string[] = [];
        if (s.prevWind !== s.wind) parts.push(`was ${s.prevWind}kn`);
        if (s.prevDir !== s.dir) parts.push(`was ${s.prevDir}`);
        extra = `<span style="color:#8A9BB0;font-size:11px;"> (${parts.join(", ")})</span>`;
      }
      
      const hours = hourlyBySpotDate[`${s.spotId}_${day.targetDate}`] || [];
      const wMin = s.userWindMin || 12;
      const ochtend = hours.filter((h: any) => h.hour >= 6 && h.hour < 12).some((h: any) => h.wind >= wMin);
      const middag = hours.filter((h: any) => h.hour >= 12 && h.hour < 17).some((h: any) => h.wind >= wMin);
      const avond = hours.filter((h: any) => h.hour >= 17 && h.hour <= 21).some((h: any) => h.wind >= wMin);
      
      let whenLabel = "";
      if (hours.length > 0) {
        if (ochtend && middag && avond) whenLabel = "hele dag";
        else if (ochtend && middag) whenLabel = "ochtend + middag";
        else if (middag && avond) whenLabel = "middag + avond";
        else if (ochtend && avond) whenLabel = "ochtend + avond";
        else if (ochtend) whenLabel = "ochtend";
        else if (middag) whenLabel = "middag";
        else if (avond) whenLabel = "avond";
      }
      const whenHtml = whenLabel ? `<div style="font-size:12px;color:#2E8FAE;font-weight:600;margin-top:2px;">${whenLabel}</div>` : "";
      
      const goToken = generateGoToken(userId, s.spotId, day.targetDate);
      const goUrl = `https://www.windping.com/api/sessions/going?user=${userId}&spot=${s.spotId}&date=${day.targetDate}&wind=${s.wind}&gust=${s.gust}&dir=${encodeURIComponent(s.dir)}&token=${goToken}`;
      
      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:13px;">${s.spotName}${whenHtml}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#3EAA8C;font-weight:700;font-size:13px;">${s.wind}kn ${s.dir}${extra}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;text-align:center;">
          <a href="${goUrl}" style="display:inline-block;padding:6px 14px;background:#3EAA8C;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;white-space:nowrap;">⚡ Ik ga!</a>
        </td>
      </tr>`;
    }).join("");
    
    // Hourly forecast tables per spot
    const hourlyTables = day.spots.map(s => {
      const hours = hourlyBySpotDate[`${s.spotId}_${day.targetDate}`];
      if (!hours?.length) return "";
      const wMin = s.userWindMin || 12;
      
      const hourCells = hours.map((h: any) => 
        `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.hour}:00</td>`
      ).join("");
      const windCells = hours.map((h: any) => {
        const color = h.wind >= wMin ? "#3EAA8C" : "#8A9BB0";
        return `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:${color};font-weight:600;font-size:12px;">${h.wind}</td>`;
      }).join("");
      const gustCells = hours.map((h: any) =>
        `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.gust}</td>`
      ).join("");
      const dirCells = hours.map((h: any) =>
        `<td style="padding:4px 6px;text-align:center;color:#8A9BB0;font-size:10px;">${h.dir}</td>`
      ).join("");
      
      // Tide info for this spot+date
      const tides = tideBySpotDate[`${s.spotId}_${day.targetDate}`] || [];
      const tideHtml = tides.length > 0
        ? `<div style="margin-top:4px;font-size:11px;color:#2E8FAE;">
            🌊 ${tides.map(t => `${t.type} ${t.time}`).join(" · ")}
          </div>`
        : "";
      
      return `
        <div style="margin:8px 0 12px;">
          <div style="font-size:11px;color:#6B7B8F;font-weight:600;margin-bottom:4px;padding-left:2px;">${s.spotName}</div>
          <table style="width:100%;border-collapse:collapse;background:#F6F1EB;border-radius:8px;overflow:hidden;">
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;"></td>${hourCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">kn</td>${windCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">gust</td>${gustCells}</tr>
            <tr><td style="padding:4px 6px;color:#8A9BB0;font-size:10px;">dir</td>${dirCells}</tr>
          </table>
          ${tideHtml}
        </div>`;
    }).join("");
    
    return `
      <div style="margin-bottom:24px;">
        <div style="font-size:16px;font-weight:700;color:#2E8FAE;margin-bottom:10px;">📅 ${dateLabel}</div>
        <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;margin-bottom:4px;box-shadow:0 1px 4px rgba(31,53,76,0.06);">
          <thead><tr>
            <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">SPOT</th>
            <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">MAX WIND</th>
            <th style="padding:8px 14px;text-align:center;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;"></th>
          </tr></thead>
          <tbody>${spotRows}</tbody>
        </table>
        ${hourlyTables}
      </div>`;
  }).join("");
  
  const html = `
    <div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="margin-bottom:28px;">
          <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
        </div>
        <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
        <p style="color:#3EAA8C;font-size:17px;font-weight:700;margin:0 0 20px;">${dayLabels.join(" en ")} ${dayLabels.length > 1 ? "zijn" : "is"} Go! 🤙</p>
        
        ${daySections}
        
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#2E8FAE;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Bekijk je alerts →</a>
        </div>
        
        <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
          <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
          &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
        </p>
      </div>
    </div>`;
  
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "WindPing <alerts@windping.com>", to, subject, html }),
  });
  
  if (!res.ok) throw new Error(`Resend bundled: ${res.status} ${await res.text()}`);
}

/* ── Downgrade email — LIGHT THEME ── */
async function sendAlertEmail(
  to: string, name: string | null, alertType: string,
  message: string, spots: any[], targetDate: string,
) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log("No RESEND_API_KEY — email skipped:", { to, alertType });
    return;
  }
  
  const dateLabel = formatDateLabel(targetDate);
  
  const subjects: Record<string, string> = {
    heads_up: `🏄 Wind alert: ${dateLabel} ziet er goed uit!`,
    go: `✅ Go! ${dateLabel} waait het op je spot`,
    downgrade: `⬇️ Forecast update: ${dateLabel} — condities gewijzigd`,
  };
  
  const greeting = name ? `Hey ${name}` : "Hey";
  
  const dateHeaderText = alertType === "go" 
    ? `${dateLabel} is Go! 🤙` 
    : alertType === "heads_up" 
    ? `${dateLabel} ziet er goed uit` 
    : `Update voor ${dateLabel}`;
  
  const spotRows = spots.map(s => {
    let extra = "";
    if (s.changed) {
      const parts: string[] = [];
      if (s.prevWind !== s.wind) parts.push(`was ${s.prevWind}kn`);
      if (s.prevDir !== s.dir) parts.push(`was ${s.prevDir}`);
      extra = `<span style="color:#8A9BB0;font-size:11px;"> (${parts.join(", ")})</span>`;
    }
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:14px;">${s.spotName}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:${s.inRange !== false ? '#3EAA8C' : '#C97A63'};font-weight:700;font-size:14px;">${s.wind}kn ${s.dir}${extra}</td>
    </tr>`;
  }).join("");
  
  let actionHtml = "";
  if (alertType === "downgrade") {
    actionHtml = `
      <div style="margin:20px 0;padding:14px 18px;background:#FFF5F2;border:1px solid #E8E0D8;border-radius:12px;">
        <p style="margin:0;color:#C97A63;font-size:13px;line-height:1.6;white-space:pre-line;">${message.replace(/\n/g, "<br>")}</p>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#E8A83E;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">I'm going anyway 🤙</a>
      </div>`;
  } else {
    actionHtml = `
      <div style="text-align:center;margin:24px 0;">
        <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#2E8FAE;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Bekijk je alerts →</a>
      </div>`;
  }
  
  const html = `
    <div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="margin-bottom:28px;">
          <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
        </div>
        <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
        <p style="color:#2E8FAE;font-size:17px;font-weight:700;margin:0 0 20px;">${dateHeaderText}</p>
        
        <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;margin-bottom:4px;box-shadow:0 1px 4px rgba(31,53,76,0.06);">
          <thead><tr>
            <th style="padding:10px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">SPOT</th>
            <th style="padding:10px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">FORECAST</th>
          </tr></thead>
          <tbody>${spotRows}</tbody>
        </table>
        
        ${actionHtml}
        
        <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
          <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
          &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
        </p>
      </div>
    </div>`;
  
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "WindPing <alerts@windping.com>",
      to,
      subject: subjects[alertType] || "WindPing Alert",
      html,
    }),
  });
  
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
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