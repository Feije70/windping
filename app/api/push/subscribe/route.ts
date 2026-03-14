/* ── app/api/push/subscribe/route.ts ───────────────────────
   Push subscription management
   - POST: save subscription
   - DELETE: remove subscription
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getUserIdFromToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const payload = JSON.parse(atob(auth.replace("Bearer ", "").split(".")[1]));
    return payload.sub || null;
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const authId = getUserIdFromToken(req);
    if (!authId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing service key" }, { status: 500 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: user, error: userErr } = await sb.from("users").select("id").eq("auth_id", authId).single();
    if (userErr || !user) return NextResponse.json({ error: "User not found", detail: userErr?.message }, { status: 404 });

    const { error } = await sb.from("push_subscriptions").upsert(
      { user_id: user.id, endpoint, keys_p256dh: keys.p256dh, keys_auth: keys.auth },
      { onConflict: "endpoint" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authId = getUserIdFromToken(req);
  if (!authId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { endpoint: string };
  const { endpoint } = body;

  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}