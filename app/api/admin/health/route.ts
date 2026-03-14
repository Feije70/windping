import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_AUTH_IDS = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!ADMIN_AUTH_IDS.includes(payload.sub)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Missing service key" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  try {
    const { data: recentAlerts } = await sb
      .from("alert_history")
      .select("id, created_at, alert_type, is_test, delivered_email, delivered_push, user_id, target_date, spot_ids, conditions, delivery_error")
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(100);

    const runs: { timestamp: string; alertCount: number; types: string[] }[] = [];
    let currentRun: { timestamp: string; alertCount: number; types: string[] } | null = null;
    for (const a of (recentAlerts || [])) {
      const runTs = a.created_at.substring(0, 16);
      if (!currentRun || currentRun.timestamp !== runTs) {
        if (currentRun) runs.push(currentRun);
        currentRun = { timestamp: runTs, alertCount: 1, types: [a.alert_type] };
      } else {
        currentRun.alertCount++;
        if (!currentRun.types.includes(a.alert_type)) currentRun.types.push(a.alert_type);
      }
    }
    if (currentRun) runs.push(currentRun);

    // Also check engine_runs heartbeat table
    const { data: engineRuns } = await sb
      .from("engine_runs")
      .select("ran_at, alerts_sent")
      .order("ran_at", { ascending: false })
      .limit(5);
    
    const lastEngineRunTime = engineRuns?.[0] ? new Date(engineRuns[0].ran_at) : null;
    const lastAlertRunTime = runs[0] ? new Date(runs[0].timestamp) : null;
    
    // Use whichever is more recent
    const lastRunTime = (() => {
      if (!lastAlertRunTime && !lastEngineRunTime) return null;
      if (!lastAlertRunTime) return lastEngineRunTime;
      if (!lastEngineRunTime) return lastAlertRunTime;
      return lastAlertRunTime > lastEngineRunTime ? lastAlertRunTime : lastEngineRunTime;
    })();
    
    const lastRun = lastRunTime ? { timestamp: lastRunTime.toISOString() } : (runs[0] || null);
    const hoursSinceLastRun = lastRunTime ? (now.getTime() - lastRunTime.getTime()) / 3600000 : null;

    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();
    const weekAlerts = (recentAlerts || []).filter(a => a.created_at >= weekAgo);

    const funnel = {
      total: weekAlerts.length,
      emailSent: weekAlerts.filter(a => a.delivered_email).length,
      emailFailed: weekAlerts.filter(a => !a.delivered_email).length,
      pushSent: weekAlerts.filter(a => a.delivered_push).length,
      pushFailed: weekAlerts.filter(a => !a.delivered_push).length,
      byType: {
        go: weekAlerts.filter(a => a.alert_type === "go").length,
        heads_up: weekAlerts.filter(a => a.alert_type === "heads_up").length,
        downgrade: weekAlerts.filter(a => a.alert_type === "downgrade").length,
        epic: weekAlerts.filter(a => a.alert_type === "epic").length,
      },
      errors: weekAlerts.filter(a => a.delivery_error).map(a => ({
        id: a.id, error: a.delivery_error, type: a.alert_type, date: a.created_at,
      })),
    };

    const { data: usersWithPrefs } = await sb
      .from("users")
      .select("id, email, name, alert_preferences(notify_email, notify_push, alerts_paused_until, available_mon, available_tue, available_wed, available_thu, available_fri, available_sat, available_sun)")
      .order("id");

    const userStatuses = (usersWithPrefs || []).map(u => {
      const prefs = Array.isArray(u.alert_preferences) ? u.alert_preferences[0] : u.alert_preferences;
      const userAlerts = (recentAlerts || []).filter(a => a.user_id === u.id);
      const lastAlert = userAlerts[0];
      const daysSinceAlert = lastAlert ? (now.getTime() - new Date(lastAlert.created_at).getTime()) / 86400000 : null;

      const availableDays = prefs ? [
        prefs.available_mon, prefs.available_tue, prefs.available_wed,
        prefs.available_thu, prefs.available_fri, prefs.available_sat, prefs.available_sun,
      ].filter(Boolean).length : 0;

      const isPaused = prefs?.alerts_paused_until && new Date(prefs.alerts_paused_until) > now;

      return {
        id: u.id,
        name: u.name || u.email?.split("@")[0] || "User " + u.id,
        email: u.email,
        notifyEmail: prefs?.notify_email ?? false,
        notifyPush: prefs?.notify_push ?? false,
        isPaused,
        availableDays,
        lastAlertAt: lastAlert?.created_at || null,
        lastAlertType: lastAlert?.alert_type || null,
        daysSinceAlert: daysSinceAlert !== null ? Math.round(daysSinceAlert * 10) / 10 : null,
        totalAlerts7d: userAlerts.filter(a => a.created_at >= weekAgo).length,
        emailDelivered7d: userAlerts.filter(a => a.created_at >= weekAgo && a.delivered_email).length,
        pushDelivered7d: userAlerts.filter(a => a.created_at >= weekAgo && a.delivered_push).length,
      };
    });

    const redFlags: { severity: "critical" | "warning" | "info"; message: string; detail?: string }[] = [];

    if (hoursSinceLastRun !== null && hoursSinceLastRun > 8) {
      redFlags.push({ severity: "critical", message: "Engine niet gedraaid voor " + Math.round(hoursSinceLastRun) + " uur", detail: "Laatste run: " + (lastRun?.timestamp || "onbekend") });
    } else if (hoursSinceLastRun !== null && hoursSinceLastRun > 7) {
      redFlags.push({ severity: "warning", message: "Engine draaide " + (Math.round(hoursSinceLastRun * 10) / 10) + " uur geleden" });
    }

    if (funnel.emailFailed > 0) {
      redFlags.push({ severity: funnel.emailFailed > 3 ? "critical" : "warning", message: funnel.emailFailed + " emails niet bezorgd deze week" });
    }

    for (const u of userStatuses) {
      if (u.notifyEmail && !u.isPaused && u.availableDays > 0 && u.daysSinceAlert !== null && u.daysSinceAlert > 3) {
        redFlags.push({ severity: "warning", message: u.name + " heeft " + Math.round(u.daysSinceAlert) + "d geen alert ontvangen", detail: u.availableDays + " beschikbare dagen, email aan" });
      }
      if (u.notifyEmail && !u.isPaused && u.availableDays === 0) {
        redFlags.push({ severity: "info", message: u.name + " heeft 0 beschikbare dagen ingesteld" });
      }
    }

    const expectedCrons = [0, 6, 12, 18];
    const last24h = new Date(now.getTime() - 24 * 3600000);
    const recentRuns = runs.filter(r => new Date(r.timestamp) > last24h);
    // Use 30 min tolerance: a run at 6:05 counts as the 6:00 cron
    const runHours = recentRuns.map(r => {
      const d = new Date(r.timestamp);
      const h = d.getUTCHours();
      const m = d.getUTCMinutes();
      // Round to nearest expected cron hour with 30 min tolerance
      return expectedCrons.find(hr => Math.abs(h - hr) === 0 || (m <= 30 && h === hr) || (m > 30 && h + 1 === hr)) ?? h;
    });
    // Only flag as missed if the expected time has passed by more than 30 minutes
    const missedCrons = expectedCrons.filter(hr => {
      if (runHours.includes(hr)) return false;
      const expectedTime = new Date(now);
      expectedTime.setUTCHours(hr, 30, 0, 0); // 30 min grace period
      if (expectedTime > now) return false; // not due yet
      // Check if it ran within 30 min of expected time
      const ranNearby = recentRuns.some(r => {
        const d = new Date(r.timestamp);
        const diff = Math.abs(d.getUTCHours() - hr) * 60 + d.getUTCMinutes();
        return diff <= 30;
      });
      return !ranNearby;
    });

    if (missedCrons.length > 0 && recentRuns.length > 0) {
      redFlags.push({ severity: missedCrons.length >= 3 ? "critical" : "warning", message: missedCrons.length + " gemiste cron runs in 24u", detail: "Gemist: " + missedCrons.map(hr => hr + ":00 UTC").join(", ") });
    }

    // Self-alert: email admin if engine down >8 hours, max 1x per hour
    const lastSelfAlert = await sb
      .from("alert_history")
      .select("created_at")
      .eq("is_test", true)
      .eq("alert_type", "engine_down")
      .gte("created_at", new Date(now.getTime() - 3600000).toISOString())
      .limit(1);
    const recentlySentSelfAlert = (lastSelfAlert.data?.length || 0) > 0;
    
    if (hoursSinceLastRun !== null && hoursSinceLastRun > 8 && !recentlySentSelfAlert) {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "feijekooistra@hotmail.com";
      const { data: recentAdminAlerts } = await sb
        .from("alert_history")
        .select("id")
        .eq("alert_type", "system_down")
        .gte("created_at", new Date(now.getTime() - 12 * 3600000).toISOString())
        .limit(1);

      if (!recentAdminAlerts?.length && RESEND_API_KEY) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "WindPing <alerts@windping.com>",
              to: ADMIN_EMAIL,
              subject: "WindPing Alert Engine is DOWN",
              html: "<div style=\"font-family:sans-serif;padding:20px;\"><h2 style=\"color:#DC2626;\">Alert Engine niet actief</h2><p>De engine heeft <strong>" + Math.round(hoursSinceLastRun) + " uur</strong> niet gedraaid.</p><p>Laatste run: " + (lastRun?.timestamp || "onbekend") + "</p><p><a href=\"https://www.windping.com/admin\">Open Admin Dashboard</a></p></div>",
            }),
          });
          await sb.from("alert_history").insert({
            user_id: 23,
            alert_type: "system_down",
            target_date: todayStr,
            spot_ids: [],
            conditions: { hoursSinceLastRun: hoursSinceLastRun, lastRun: lastRun?.timestamp },
            is_test: false,
          });
        } catch (e) { console.error("Admin alert email error:", e); }
      }
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      heartbeat: {
        lastRun: lastRun?.timestamp || null,
        hoursSinceLastRun: hoursSinceLastRun !== null ? Math.round(hoursSinceLastRun * 10) / 10 : null,
        recentRuns: runs.slice(0, 10),
        status: hoursSinceLastRun === null ? "unknown" : hoursSinceLastRun < 7 ? "healthy" : hoursSinceLastRun < 9 ? "warning" : "critical",
      },
      funnel,
      users: userStatuses,
      redFlags: redFlags.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      }),
    });

  } catch (err) {
    console.error("Health API error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}