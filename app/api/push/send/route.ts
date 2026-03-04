/* ── app/api/push/send/route.ts ────────────────────────────
   Send push notifications
   Called by alert engine after creating alerts
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:alerts@windping.com";

/* ── Web Push Implementation ── */

async function sendPushNotification(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: object
): Promise<boolean> {
  // Import web-push compatible crypto
  const payloadStr = JSON.stringify(payload);
  
  try {
    // Use the web push protocol directly
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        TTL: "86400",
      },
      body: payloadStr,
    });
    
    if (response.status === 201 || response.status === 200) return true;
    if (response.status === 404 || response.status === 410) {
      // Subscription expired/invalid — clean up
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      return false;
    }
    console.error(`Push failed: ${response.status} ${await response.text()}`);
    return false;
  } catch (e: any) {
    console.error("Push error:", e.message);
    return false;
  }
}

export async function POST(req: Request) {
  // Auth: only internal calls (from alert engine)
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  
  if (authHeader !== `Bearer ${cronSecret}` && !authHeader.includes(cronSecret)) {
    // Also allow calls with admin token
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
  
  const body = await req.json();
  const { userId, title, message, url, alertType } = body;
  
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Get all push subscriptions for this user
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("user_id", userId);
  
  if (!subs?.length) {
    return NextResponse.json({ sent: 0, reason: "no subscriptions" });
  }
  
  const emojis: Record<string, string> = {
    heads_up: "📢",
    go: "✅",
    downgrade: "⬇️",
    epic: "🤙",
  };
  
  const payload = {
    title: title || `${emojis[alertType] || "🏄"} WindPing`,
    body: message || "Je hebt een nieuwe wind alert!",
    url: url || "/alert",
  };
  
  let sent = 0;
  let failed = 0;
  
  for (const sub of subs) {
    const success = await sendPushNotification(sub, payload);
    if (success) sent++;
    else failed++;
  }
  
  return NextResponse.json({ sent, failed, total: subs.length });
}