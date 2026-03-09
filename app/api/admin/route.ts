/* ── app/api/admin/data/route.ts ───────────────────────────
   Admin Data Endpoint — reads data with service role key
   ──────────────────────────────────────────────────────────── */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_AUTH_IDS = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    const adminIds = ADMIN_AUTH_IDS.filter(id => id.length > 0);
    if (!adminIds.length || !adminIds.includes(payload.sub)) {
      return NextResponse.json({
        error: "Not admin",
        debug: {
          tokenSub: payload.sub,
          adminIdsConfigured: adminIds.length,
          adminIdsPreview: adminIds.map(id => id.substring(0, 8) + "..."),
        }
      }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid token", detail: e.message }, { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Missing service key" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [{ data: users }, { data: spots }, { data: alerts }] = await Promise.all([
    sb.from("users").select("id, email, name").order("id"),
    sb.from("spots").select("id, display_name").order("display_name").limit(5000),
    sb.from("alert_history").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    users: users || [],
    spots: spots || [],
    alerts: alerts || [],
  });
}