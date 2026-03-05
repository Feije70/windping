/* ── app/api/admin/users/route.ts ──
   Returns all users for admin dashboard (uses service role key, bypasses RLS)
── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isAdmin(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const adminIds = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
    return adminIds.includes(payload.sub);
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!isAdmin(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await sb
    .from("users")
    .select("id, name, email, min_wind_speed, max_wind_speed, welcome_shown, subscription_status")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}