/* ── app/api/alerts/diagnose/route.ts ──
   Per-user diagnosis: why did/didn't you get an alert?
── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const DAY_DB: Record<number, string> = { 0: "available_sun", 1: "available_mon", 2: "available_tue", 3: "available_wed", 4: "available_thu", 5: "available_fri", 6: "available_sat" };
const DAY_NL: Record<number, string> = { 0: "Zo", 1: "Ma", 2: "Di", 3: "Wo", 4: "Do", 5: "Vr", 6: "Za" };

async function getForecast(lat: number, lon: number, days: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=windspeed_10m,winddirection_10m,windgusts_10m&wind_speed_unit=kn&forecast_days=${days}&timezone=UTC`;
  const res = await fetch(url);
  return await res.json();
}

function degToDir(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function evaluateSpot(forecast: any, dayOffset: number, spot: any, cond: any) {
  const times: string[] = forecast.hourly?.time || [];
  const winds: number[] = forecast.hourly?.windspeed_10m || [];
  const dirs: number[] = forecast.hourly?.winddirection_10m || [];
  const gusts: number[] = forecast.hourly?.windgusts_10m || [];

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const dateStr = targetDate.toISOString().split("T")[0];

  const dayIndices = times.reduce((acc: number[], t, i) => { if (t.startsWith(dateStr)) acc.push(i); return acc; }, []);
  const dayWinds = dayIndices.map(i => winds[i]).filter(Boolean);
  const dayDirs = dayIndices.map(i => dirs[i]).filter(Boolean);
  const dayGusts = dayIndices.map(i => gusts[i]).filter(Boolean);

  const avgWind = dayWinds.length ? Math.round(dayWinds.reduce((a, b) => a + b, 0) / dayWinds.length) : 0;
  const avgDir = dayDirs.length ? Math.round(dayDirs.reduce((a, b) => a + b, 0) / dayDirs.length) : 0;
  const avgGust = dayGusts.length ? Math.round(dayGusts.reduce((a, b) => a + b, 0) / dayGusts.length) : 0;
  const dirStr = degToDir(avgDir);

  const minWind = cond?.wind_min ?? 0;
  const maxWind = cond?.wind_max ?? 999;
  const preferredDirs: string[] = cond?.wind_directions || spot?.good_directions || [];

  const windOk = avgWind >= minWind && avgWind <= maxWind;
  const dirOk = preferredDirs.length === 0 || preferredDirs.includes(dirStr);
  const inRange = windOk && dirOk;

  const reasons: string[] = [];
  if (!windOk) reasons.push(`Wind ${avgWind}kn (jouw range: ${minWind}-${maxWind}kn)`);
  if (!dirOk) reasons.push(`Richting ${dirStr} (jouw voorkeuren: ${preferredDirs.join(", ")})`);

  return { spotId: spot.id, spotName: spot.display_name, wind: avgWind, gust: avgGust, dir: dirStr, dirDeg: avgDir, inRange, windOk, dirOk, minWind, maxWind, preferredDirs, reasons };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  
  // Auth check
  let isAdmin = false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const adminIds = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
    isAdmin = adminIds.includes(payload.sub);
  } catch {}
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  try {
    // Get user + prefs
    const { data: user } = await sb.from("users").select(`
      id, email, name,
      alert_preferences(
        lookahead_days, epic_any_day, alerts_paused_until,
        available_mon, available_tue, available_wed, available_thu, available_fri, available_sat, available_sun,
        notify_email, notify_push
      )
    `).eq("id", userId).single();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const prefs = Array.isArray(user.alert_preferences) ? user.alert_preferences[0] : user.alert_preferences;
    if (!prefs) return NextResponse.json({ error: "No alert preferences found" }, { status: 404 });

    // Get user spots + conditions
    const { data: userSpots } = await sb.from("user_spots").select("spot_id").eq("user_id", userId);
    if (!userSpots?.length) return NextResponse.json({ error: "No spots configured" }, { status: 404 });

    const spotIds = userSpots.map((x: any) => x.spot_id);
    const [{ data: spots }, { data: conditions }] = await Promise.all([
      sb.from("spots").select("id, display_name, latitude, longitude, good_directions").in("id", spotIds),
      sb.from("ideal_conditions").select("*").eq("user_id", userId).in("spot_id", spotIds),
    ]);

    const condsMap: Record<number, any> = {};
    (conditions || []).forEach((c: any) => { condsMap[c.spot_id] = c; });

    // Get existing alerts
    const { data: existingAlerts } = await sb.from("alert_history")
      .select("alert_type, target_date, spot_ids, primary_spot_id, created_at, delivered_email, delivered_push, delivery_error")
      .eq("user_id", userId)
      .gte("target_date", today)
      .eq("is_test", false)
      .order("created_at", { ascending: false });

    const lookahead = prefs.lookahead_days || 3;
    const days = [];

    for (let d = 0; d <= lookahead; d++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + d);
      const dateStr = targetDate.toISOString().split("T")[0];
      const dayOfWeek = targetDate.getDay();
      const isAvailable = (prefs as any)[DAY_DB[dayOfWeek]];
      const isTomorrowOrToday = d <= 1;

      const prevAlerts = (existingAlerts || []).filter((a: any) => a.target_date === dateStr);
      const hadGo = prevAlerts.some((a: any) => a.alert_type === "go");
      const hadHeadsUp = prevAlerts.some((a: any) => a.alert_type === "heads_up");
      const hadDowngrade = prevAlerts.some((a: any) => a.alert_type === "downgrade");

      const spotResults = [];
      for (const spot of (spots || [])) {
        if (!spot.latitude || !spot.longitude) {
          spotResults.push({ spotId: spot.id, spotName: spot.display_name, error: "Geen coordinaten" });
          continue;
        }
        try {
          const forecast = await getForecast(spot.latitude, spot.longitude, lookahead + 2);
          const result = evaluateSpot(forecast, d, spot, condsMap[spot.id]);
          const cond = condsMap[spot.id];
          spotResults.push({
            ...result,
            userConditions: cond ? {
              windMin: cond.wind_min,
              windMax: cond.wind_max,
              directions: cond.wind_directions || spot.good_directions || [],
            } : { windMin: 0, windMax: 999, directions: spot.good_directions || [] },
          });
        } catch (e: any) {
          spotResults.push({ spotId: spot.id, spotName: spot.display_name, error: e.message });
        }
      }

      const goSpots = spotResults.filter((s: any) => s.inRange);

      // Determine what alert WOULD be sent
      let wouldSend: string | null = null;
      let wouldNotSendReason: string | null = null;

      if (!isAvailable && !prefs.epic_any_day) {
        wouldNotSendReason = `${DAY_NL[dayOfWeek]} niet beschikbaar`;
      } else if (goSpots.length === 0) {
        wouldNotSendReason = "Geen spot in range";
      } else if (isTomorrowOrToday && !hadGo) {
        wouldSend = "go";
      } else if (!isTomorrowOrToday && !hadHeadsUp && !hadGo) {
        wouldSend = "heads_up";
      } else if (hadGo || hadHeadsUp) {
        wouldNotSendReason = `Al verstuurd (${hadGo ? "go" : "heads_up"})`;
      }

      days.push({
        date: dateStr,
        dayLabel: `${DAY_NL[dayOfWeek]} ${targetDate.getDate()}/${targetDate.getMonth() + 1}`,
        isAvailable,
        isTomorrowOrToday,
        hadGo,
        hadHeadsUp,
        hadDowngrade,
        spotResults,
        goSpots: goSpots.length,
        wouldSend,
        wouldNotSendReason,
        sentAlerts: prevAlerts,
      });
    }

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      prefs: {
        lookahead: lookahead,
        epicAnyDay: prefs.epic_any_day,
        paused: prefs.alerts_paused_until ? new Date(prefs.alerts_paused_until) > now : false,
        availability: {
          ma: prefs.available_mon, di: prefs.available_tue, wo: prefs.available_wed,
          do: prefs.available_thu, vr: prefs.available_fri, za: prefs.available_sat, zo: prefs.available_sun,
        },
        notifyEmail: prefs.notify_email,
        notifyPush: prefs.notify_push,
      },
      spots: (spots || []).map(s => ({
        id: s.id, name: s.display_name,
        conditions: condsMap[s.id] ? {
          windMin: condsMap[s.id].wind_min,
          windMax: condsMap[s.id].wind_max,
          directions: condsMap[s.id].wind_directions || s.good_directions || [],
        } : null,
      })),
      days,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}