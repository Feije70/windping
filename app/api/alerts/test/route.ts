/* ── app/api/alerts/test/route.ts ──────────────────────────
   Test Alert Endpoint v2
   
   Actions:
   - send_test: Nep-alert met ECHTE forecast/tides, stuurt email (design check)
   - evaluate:  Echte forecast, toont resultaat maar stuurt niks
   - run_live:  Echte forecast, stuurt email + push (zoals cron doet)
   - test_push: Stuurt push met echte spot data naar /alert
   - clear_test: Verwijdert alle test alerts
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STORMGLASS_KEY = process.env.STORMGLASS_API_KEY || "";
const ADMIN_AUTH_IDS = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
const CRON_SECRET = process.env.CRON_SECRET || "";

const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToDir(deg: number) { return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

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

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  if (token === CRON_SECRET) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return ADMIN_AUTH_IDS.includes(payload.sub);
  } catch { return false; }
}

async function fetchHourlyForDay(lat: number, lng: number, dateStr: string) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=7`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.hourly?.time) return [];
    return [6, 9, 12, 15, 18].map(h => {
      const idx = data.hourly.time.indexOf(`${dateStr}T${h.toString().padStart(2, "0")}:00`);
      return idx >= 0 ? { hour: h, wind: Math.round(data.hourly.wind_speed_10m[idx] || 0), gust: Math.round(data.hourly.wind_gusts_10m[idx] || 0), dir: degToDir(data.hourly.wind_direction_10m[idx] || 0) } : null;
    }).filter(Boolean);
  } catch { return []; }
}

async function fetchDailyMax(lat: number, lng: number, dateStr: string) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=7`);
    if (!res.ok) return { wind: 0, gust: 0, dir: "N", dirDeg: 0 };
    const data = await res.json();
    const idx = (data.daily?.time || []).indexOf(dateStr);
    if (idx < 0) return { wind: 0, gust: 0, dir: "N", dirDeg: 0 };
    const dirDeg = data.daily.wind_direction_10m_dominant[idx] || 0;
    return { wind: Math.round(data.daily.wind_speed_10m_max[idx] || 0), gust: Math.round(data.daily.wind_gusts_10m_max[idx] || 0), dir: degToDir(dirDeg), dirDeg };
  } catch { return { wind: 0, gust: 0, dir: "N", dirDeg: 0 }; }
}

async function fetchTides(lat: number, lng: number, dateStr: string) {
  if (!STORMGLASS_KEY) return [];
  try {
    const start = new Date(dateStr + "T00:00:00Z");
    const end = new Date(start.getTime() + 2 * 86400000);
    const res = await fetch(`https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${start.toISOString()}&end=${end.toISOString()}`, { headers: { Authorization: STORMGLASS_KEY } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter((e: any) => new Date(e.time).toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" }) === dateStr)
      .map((e: any) => ({ time: new Date(e.time).toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }), type: e.type === "high" ? "HW" : "LW" }));
  } catch { return []; }
}

/* ── Build full light-theme email HTML ── */
function buildEmailHtml(
  greeting: string, dateLabel: string, dateHeaderText: string,
  spotData: any[], hourlyBySpot: Record<string, any[]>, tideBySpot: Record<string, any[]>,
  targetDate: string, isDowngrade: boolean, downgradeMessage?: string, userId?: number
): string {
  const spotRows = spotData.map(s => {
    const hours = hourlyBySpot[`${s.spotId}_${targetDate}`] || [];
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
    
    let goButtonHtml = "";
    if (userId && !isDowngrade) {
      const goSecret = process.env.CRON_SECRET || "windping-secret";
      const goRaw = `${userId}-${s.spotId}-${targetDate}-${goSecret}`;
      let goHash = 0;
      for (let i = 0; i < goRaw.length; i++) { goHash = ((goHash << 5) - goHash) + goRaw.charCodeAt(i); goHash |= 0; }
      const goToken = Math.abs(goHash).toString(36);
      const goUrl = `https://www.windping.com/api/sessions/going?user=${userId}&spot=${s.spotId}&date=${targetDate}&wind=${s.wind}&gust=${s.gust}&dir=${encodeURIComponent(s.dir)}&token=${goToken}`;
      goButtonHtml = `<td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;text-align:center;">
        <a href="${goUrl}" style="display:inline-block;padding:6px 14px;background:#3EAA8C;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;white-space:nowrap;">⚡ Ik ga!</a>
      </td>`;
    }
    
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:13px;">${s.spotName}${whenHtml}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:${s.inRange ? '#3EAA8C' : '#C97A63'};font-weight:700;font-size:13px;">${s.wind}kn ${s.dir}</td>
      ${goButtonHtml}
    </tr>`;
  }).join("");

  const hourlyTables = spotData.map(s => {
    const hours = hourlyBySpot[`${s.spotId}_${targetDate}`];
    if (!hours?.length) return "";
    const wMin = s.userWindMin || 12;
    const hourCells = hours.map((h: any) => `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.hour}:00</td>`).join("");
    const windCells = hours.map((h: any) => `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:${h.wind >= wMin ? "#3EAA8C" : "#8A9BB0"};font-weight:600;font-size:12px;">${h.wind}</td>`).join("");
    const gustCells = hours.map((h: any) => `<td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E8E0D8;color:#6B7B8F;font-size:11px;">${h.gust}</td>`).join("");
    const dirCells = hours.map((h: any) => `<td style="padding:4px 6px;text-align:center;color:#8A9BB0;font-size:10px;">${h.dir}</td>`).join("");
    const tides = tideBySpot[`${s.spotId}_${targetDate}`] || [];
    const tideHtml = tides.length > 0 ? `<div style="margin-top:4px;font-size:11px;color:#2E8FAE;">🌊 ${tides.map((t: any) => `${t.type} ${t.time}`).join(" · ")}</div>` : "";
    return `<div style="margin:8px 0 12px;">
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

  let actionHtml = "";
  if (isDowngrade) {
    actionHtml = `
      <div style="margin:20px 0;padding:14px 18px;background:#FFF5F2;border:1px solid #E8E0D8;border-radius:12px;">
        <p style="margin:0;color:#C97A63;font-size:13px;line-height:1.6;white-space:pre-line;">${downgradeMessage || ""}</p>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#E8A83E;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">I'm going anyway 🤙</a>
      </div>`;
  } else {
    actionHtml = `<div style="text-align:center;margin:24px 0;">
      <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#2E8FAE;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Bekijk je alerts →</a>
    </div>`;
  }

  return `<div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;">
      <div style="margin-bottom:28px;">
        <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
      </div>
      <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
      <p style="color:${isDowngrade ? '#C97A63' : '#3EAA8C'};font-size:17px;font-weight:700;margin:0 0 20px;">${dateHeaderText}</p>
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
      </div>
      ${actionHtml}
      <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
        <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
        &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
        &nbsp;·&nbsp; <span style="color:#8A9BB0;">TEST EMAIL</span>
      </p>
    </div>
  </div>`;
}

export async function POST(req: Request) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Missing service key" }, { status: 500 });
  }
  
  const body = await req.json();
  const { action, userId, alertType, spotId } = body;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  /* ── evaluate: test mode (no email/push sent) ── */
  if (action === "evaluate") {
    const evalUrl = new URL("/api/alerts/evaluate", req.url);
    const res = await fetch(evalUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true, userId }),
    });
    return NextResponse.json(await res.json());
  }
  
  /* ── run_live: real engine run, sends email + push ── */
  if (action === "run_live") {
    const evalUrl = new URL("/api/alerts/evaluate", req.url);
    const res = await fetch(evalUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: false, userId }),
    });
    return NextResponse.json(await res.json());
  }
  
  /* ── send_test: real forecast data, sends email for design check ── */
  if (action === "send_test") {
    const { data: user } = await sb.from("users").select("id, email, name").eq("id", userId).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    
    // Get user's spots
    const { data: userSpots } = await sb.from("user_spots").select("spot_id").eq("user_id", userId);
    const allSpotIds = (userSpots || []).map((x: any) => x.spot_id);
    
    let spotsToUse: any[] = [];
    if (spotId) {
      const { data } = await sb.from("spots").select("id, display_name, latitude, longitude").eq("id", spotId).single();
      if (data) spotsToUse = [data];
    } else if (allSpotIds.length) {
      const { data } = await sb.from("spots").select("id, display_name, latitude, longitude").in("id", allSpotIds);
      spotsToUse = data || [];
    }
    if (!spotsToUse.length) spotsToUse = [{ id: 0, display_name: "Test Spot", latitude: 52.46, longitude: 4.56 }];
    
    // Get ideal conditions
    const { data: idealConds } = await sb.from("ideal_conditions").select("*").eq("user_id", userId).in("spot_id", spotsToUse.map((s: any) => s.id));
    const condsMap: Record<number, any> = {};
    (idealConds || []).forEach((c: any) => { condsMap[c.spot_id] = c; });
    
    const targetDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const type = alertType || "go";
    const dateLabel = formatDateLabel(targetDate);
    
    // Fetch real forecast + tides for all spots
    const spotData: any[] = [];
    const hourlyBySpot: Record<string, any[]> = {};
    const tideBySpot: Record<string, any[]> = {};
    
    for (const s of spotsToUse) {
      if (!s.latitude || !s.longitude) continue;
      const daily = await fetchDailyMax(s.latitude, s.longitude, targetDate);
      const ic = condsMap[s.id];
      const wMin = ic?.wind_min ?? 12;
      const wMax = ic?.wind_max ?? 35;
      const windOk = daily.wind >= wMin && daily.wind <= wMax;
      
      // Direction check
      const rawDirs: any[] = ic?.directions?.length ? ic.directions : [];
      let dirOk = true;
      if (rawDirs.length > 0) {
        if (typeof rawDirs[0] === "string") {
          dirOk = rawDirs.includes(daily.dir);
        } else {
          const dIdx = Math.round(((daily.dirDeg % 360 + 360) % 360) / 22.5) % 16;
          dirOk = rawDirs[dIdx] === true;
        }
      }
      
      const inRange = type !== "downgrade" ? (windOk && dirOk) : false;
      
      spotData.push({
        spotId: s.id, spotName: s.display_name,
        wind: daily.wind, gust: daily.gust, dir: daily.dir, dirDeg: daily.dirDeg,
        inRange, windOk, dirOk,
        userWindMin: wMin, userWindMax: wMax,
      });
      
      const key = `${s.id}_${targetDate}`;
      hourlyBySpot[key] = await fetchHourlyForDay(s.latitude, s.longitude, targetDate);
      tideBySpot[key] = await fetchTides(s.latitude, s.longitude, targetDate);
    }
    
    // For go/heads_up: only show spots that are actually in range
    if (type === "go" || type === "heads_up" || type === "epic") {
      const goSpots = spotData.filter(s => s.inRange);
      if (goSpots.length > 0) {
        spotData.length = 0;
        spotData.push(...goSpots);
      }
      // If no spots match, keep all so the email still shows something
    }
    
    // Downgrade overrides
    let downgradeMsg = "";
    if (type === "downgrade") {
      for (const s of spotData) {
        s.prevWind = s.wind; s.prevDir = s.dir;
        s.wind = Math.max(0, s.userWindMin - 4); s.inRange = false;
      }
      downgradeMsg = spotData.map(s => `${s.spotName}: Wind ${s.prevWind}kn → ${s.wind}kn (minimum: ${s.userWindMin}kn)`).join("\n");
    }
    
    // Save to history
    const { data: alert, error } = await sb.from("alert_history").insert({
      user_id: userId, alert_type: type, target_date: targetDate,
      spot_ids: spotData.map((s: any) => s.spotId),
      primary_spot_id: spotData[0]?.spotId,
      conditions: { spots: spotData },
      is_test: true,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Send email
    let emailResult = "skipped";
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY && user.email) {
      try {
        const greeting = user.name ? `Hey ${user.name}` : "Hey";
        const dateHeaderText = type === "go" ? `${dateLabel} is Go! 🤙`
          : type === "heads_up" ? `${dateLabel} ziet er goed uit`
          : type === "downgrade" ? `Update voor ${dateLabel}`
          : `${dateLabel} is EPIC! 🤙`;
        
        const subjects: Record<string, string> = {
          heads_up: `🏄 Wind alert: ${dateLabel} ziet er goed uit!`,
          go: `✅ Go! ${dateLabel} waait het op je spot`,
          downgrade: `⬇️ Forecast update: ${dateLabel} — condities gewijzigd`,
          epic: `🤙 EPIC condities ${dateLabel}!`,
        };
        
        const html = buildEmailHtml(greeting, dateLabel, dateHeaderText, spotData, hourlyBySpot, tideBySpot, targetDate, type === "downgrade", downgradeMsg, userId);
        
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "WindPing <alerts@windping.com>", to: user.email,
            subject: `[TEST] ${subjects[type] || "WindPing Alert"}`, html,
          }),
        });
        emailResult = res.ok ? "sent" : `error: ${res.status} ${await res.text()}`;
        if (res.ok) await sb.from("alert_history").update({ delivered_email: true }).eq("id", alert.id);
      } catch (e: any) { emailResult = `error: ${e.message}`; }
    }
    
    return NextResponse.json({
      message: "Test alert created with real forecast data",
      emailResult, alert, spotData,
      tides: Object.fromEntries(Object.entries(tideBySpot).map(([k, v]) => [k, v])),
      user: { id: user.id, email: user.email, name: user.name },
    });
  }
  
  /* ── preview ── */
  if (action === "preview") {
    const evalUrl = new URL("/api/alerts/evaluate", req.url);
    const res = await fetch(evalUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true, userId }),
    });
    return NextResponse.json({ preview: true, ...(await res.json()) });
  }
  
  /* ── clear_test ── */
  if (action === "clear_test") {
    const { error } = await sb.from("alert_history").delete().eq("is_test", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Test alerts cleared" });
  }
  
  /* ── test_push: real spot data in push notification ── */
  if (action === "test_push") {
    const { data: user } = await sb.from("users").select("id, name").eq("id", userId).single();
    const { data: subs } = await sb.from("push_subscriptions").select("endpoint, keys_p256dh, keys_auth").eq("user_id", userId);
    if (!subs?.length) return NextResponse.json({ error: "No push subscriptions found", userId });
    
    const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return NextResponse.json({ error: "VAPID keys not configured" });
    
    // Get user's first spot for real data
    const { data: userSpots } = await sb.from("user_spots").select("spot_id").eq("user_id", userId).limit(3);
    const spotIds = (userSpots || []).map((x: any) => x.spot_id);
    const { data: spots } = spotIds.length ? await sb.from("spots").select("id, display_name, latitude, longitude").in("id", spotIds) : { data: [] };
    
    const targetDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const spotDetails: string[] = [];
    
    for (const s of (spots || [])) {
      if (!s.latitude) continue;
      const daily = await fetchDailyMax(s.latitude, s.longitude, targetDate);
      spotDetails.push(`${s.display_name}: ${daily.wind}kn ${daily.dir}`);
    }
    
    const pushBody = spotDetails.length > 0 ? spotDetails.join(" · ") : "Morgen waait het op je spot! 🤙";
    
    const results: any[] = [];
    try {
      const webpush = await import("web-push");
      webpush.setVapidDetails("mailto:alerts@windping.com", VAPID_PUBLIC, VAPID_PRIVATE);
      
      const payload = JSON.stringify({
        title: `✅ ${formatDateLabel(targetDate)} is Go!`,
        body: pushBody,
        url: "/alert",
      });
      
      for (const sub of subs) {
        try {
          const result = await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload, { TTL: 86400 }
          );
          results.push({ endpoint: sub.endpoint.slice(0, 60) + "...", status: result.statusCode, success: true });
        } catch (pe: any) {
          results.push({ endpoint: sub.endpoint.slice(0, 60) + "...", success: false, statusCode: pe.statusCode, error: pe.body || pe.message });
          if (pe.statusCode === 404 || pe.statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    } catch (e: any) { return NextResponse.json({ error: "web-push failed", detail: e.message }); }
    
    return NextResponse.json({ pushResults: results, subscriptions: subs.length, body: pushBody });
  }
  
  return NextResponse.json({ error: "Unknown action. Use: evaluate, send_test, run_live, preview, clear_test, test_push" }, { status: 400 });
}