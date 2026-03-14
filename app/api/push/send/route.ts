/* ── app/api/push/send/route.ts ────────────────────────────
   Send push notifications via web-push package (VAPID)
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface WebPushError {
  statusCode?: number;
  message?: string;
  body?: string;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";

  if (authHeader !== `Bearer ${cronSecret}` && !authHeader.includes(cronSecret)) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = JSON.parse(atob(token.split(".")[1]));
      const adminIds = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
      if (!adminIds.includes(payload.sub)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const body = await req.json() as { userId: number; title?: string; message?: string; url?: string; alertType?: string };
  const { userId, title, message, url, alertType } = body;

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("user_id", userId);

  if (!subs?.length) return NextResponse.json({ sent: 0, reason: "no subscriptions" });

  const emojis: Record<string, string> = {
    heads_up: "📢", go: "✅", downgrade: "⬇️", epic: "🤙", session: "🏄",
  };

  const payload = JSON.stringify({
    title: title || `${emojis[alertType ?? ""] || "🏄"} WindPing`,
    body: message || "Je hebt een nieuwe wind alert!",
    url: url || "/alert",
  });

  let sent = 0, failed = 0;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails("mailto:alerts@windping.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload
        );
        sent++;
      } catch (e) {
        const err = e as WebPushError;
        console.error("Push failed:", sub.endpoint.slice(0, 50), err.statusCode, err.body || getErrorMessage(e));
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        failed++;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: "web-push failed", detail: getErrorMessage(e) }, { status: 500 });
  }

  return NextResponse.json({ sent, failed, total: subs.length });
}