/* ── app/api/sessions/nudge/route.ts ───────────────────────
   Post-session nudge
   
   Schedule: Daily at 21:00 UTC (22:00 NL) via Vercel Cron
   Also callable via ?key= for backup cron
   
   Logic:
   - Find sessions with status='going' where session_date <= today
   - Send email + push: "Hoe was je sessie op [spot]?"
   - Mark session as nudged to prevent duplicates
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  
  // Allow via key, cron secret, or authorization header
  const authHeader = req.headers.get("authorization") || "";
  const isAuthorized = key === "WindPing-extra-redundancy-2026" 
    || (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`)
    || authHeader.includes(CRON_SECRET);
  
  if (!isAuthorized) {
    return NextResponse.json({ status: "ok", endpoint: "sessions/nudge" });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Missing service key" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().split("T")[0];

  try {
    // Find "going" sessions where date has passed or is today, not yet nudged
    const { data: pendingSessions, error } = await sb
      .from("sessions")
      .select("id, created_by, spot_id, session_date, forecast_wind, forecast_dir, nudge_sent")
      .eq("status", "going")
      .lte("session_date", today)
      .or("nudge_sent.is.null,nudge_sent.eq.false");

    if (error) throw error;
    if (!pendingSessions?.length) {
      return NextResponse.json({ message: "No pending sessions to nudge", count: 0 });
    }

    // Get spot names
    const spotIds = [...new Set(pendingSessions.map(s => s.spot_id))];
    const { data: spots } = await sb
      .from("spots")
      .select("id, display_name")
      .in("id", spotIds);
    const spotNames: Record<number, string> = {};
    (spots || []).forEach((s: any) => { spotNames[s.id] = s.display_name; });

    // Get user info
    const userIds = [...new Set(pendingSessions.map(s => s.created_by))];
    const { data: users } = await sb
      .from("users")
      .select("id, email, name, auth_id")
      .in("id", userIds);
    const userMap: Record<number, any> = {};
    (users || []).forEach((u: any) => { userMap[u.id] = u; });

    let nudgedCount = 0;
    const results: any[] = [];

    // Group sessions by user
    const byUser: Record<number, typeof pendingSessions> = {};
    for (const session of pendingSessions) {
      if (!byUser[session.created_by]) byUser[session.created_by] = [];
      byUser[session.created_by].push(session);
    }

    for (const [userId, sessions] of Object.entries(byUser)) {
      const user = userMap[Number(userId)];
      if (!user?.email) continue;

      const sessionLines = sessions.map(s => {
        const spotName = spotNames[s.spot_id] || "je spot";
        const wind = s.forecast_wind ? `${s.forecast_wind}kn ${s.forecast_dir || ""}` : "";
        return { spotName, wind, sessionId: s.id, date: s.session_date };
      });

      // Send email
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        try {
          const greeting = user.name ? `Hey ${user.name}` : "Hey";
          const spotsHtml = sessionLines.map(s => `
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#1F354C;font-size:14px;font-weight:600;">${s.spotName}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #E8E0D8;color:#3EAA8C;font-size:13px;">${s.wind}</td>
            </tr>
          `).join("");

          const html = `
            <div style="background:#F6F1EB;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <div style="max-width:480px;margin:0 auto;">
                <div style="margin-bottom:28px;">
                  <span style="color:#2E8FAE;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Wind</span><span style="color:#3EAA8C;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Ping</span>
                </div>
                <p style="color:#1F354C;font-size:15px;margin:0 0 6px;">${greeting},</p>
                <p style="color:#2E8FAE;font-size:17px;font-weight:700;margin:0 0 20px;">Hoe was je sessie? 🏄</p>
                
                <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 4px rgba(31,53,76,0.06);">
                  <thead><tr>
                    <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">SPOT</th>
                    <th style="padding:8px 14px;text-align:left;color:#8A9BB0;font-size:10px;font-weight:700;letter-spacing:0.1em;border-bottom:1px solid #E8E0D8;">FORECAST</th>
                  </tr></thead>
                  <tbody>${spotsHtml}</tbody>
                </table>

                <div style="text-align:center;margin:24px 0;">
                  <a href="https://www.windping.com/alert" style="display:inline-block;padding:13px 28px;background:#3EAA8C;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Log je sessie →</a>
                </div>

                <div style="padding:14px 18px;background:#F0F7FA;border-radius:12px;margin-bottom:20px;">
                  <div style="font-size:12px;color:#6B7B8F;line-height:1.6;">
                    ⭐ Beoordeel je sessie, voeg foto's toe en houd je windsurf-geschiedenis bij.
                  </div>
                </div>
                
                <p style="color:#8A9BB0;font-size:11px;margin:28px 0 0;text-align:center;line-height:1.6;">
                  <a href="https://www.windping.com/voorkeuren" style="color:#8A9BB0;text-decoration:underline;">Alert settings</a>
                  &nbsp;·&nbsp; <a href="https://www.windping.com" style="color:#8A9BB0;text-decoration:underline;">WindPing</a>
                </p>
              </div>
            </div>`;

          const subject = sessionLines.length === 1
            ? `🏄 Hoe was ${sessionLines[0].spotName}?`
            : `🏄 Hoe waren je sessies vandaag?`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: "WindPing <alerts@windping.com>", to: user.email, subject, html }),
          });

          results.push({ userId: Number(userId), email: user.email, sessions: sessionLines.length, emailSent: true });
        } catch (e: any) {
          console.error("Nudge email error:", e);
          results.push({ userId: Number(userId), error: e.message });
        }
      }

      // Send push
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
          .eq("user_id", Number(userId));

        if (subs?.length) {
          const spotName = sessionLines[0]?.spotName || "je spot";
          const payload = JSON.stringify({
            title: "Hoe was je sessie? 🏄",
            body: sessionLines.length === 1
              ? `Log je sessie op ${spotName}`
              : `Log je ${sessionLines.length} sessies van vandaag`,
            url: "/alert",
          });

          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
                payload,
                { TTL: 86400 }
              );
            } catch (pe: any) {
              if (pe.statusCode === 404 || pe.statusCode === 410) {
                await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
            }
          }
        }
      } catch (e) { console.error("Nudge push error:", e); }

      // Mark sessions as nudged
      for (const session of sessions) {
        await sb.from("sessions").update({ nudge_sent: true }).eq("id", session.id);
      }

      nudgedCount += sessions.length;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      message: `Nudged ${nudgedCount} sessions for ${Object.keys(byUser).length} users`,
      count: nudgedCount,
      results,
    });

  } catch (e: any) {
    console.error("Session nudge error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}