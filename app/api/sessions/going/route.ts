/* ── app/api/sessions/going/route.ts ───────────────────────
   "Ik ga!" via email link
   
   URL: /api/sessions/going?user=X&spot=Y&date=Z&alert=A&wind=W&gust=G&dir=D&token=T
   
   Creates a session and redirects to /alert
   Token = simple HMAC of user+spot+date to prevent tampering
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "windping-secret";

function generateToken(userId: string, spotId: string, date: string): string {
  // Simple hash — not cryptographic but prevents casual tampering
  const raw = `${userId}-${spotId}-${date}-${CRON_SECRET}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user");
  const spotId = url.searchParams.get("spot");
  const date = url.searchParams.get("date");
  const alertId = url.searchParams.get("alert");
  const wind = url.searchParams.get("wind");
  const gust = url.searchParams.get("gust");
  const dir = url.searchParams.get("dir");
  const token = url.searchParams.get("token");

  if (!userId || !spotId || !date || !token) {
    return NextResponse.redirect(new URL("/alert", req.url));
  }

  // Verify token
  const expectedToken = generateToken(userId, spotId, date);
  if (token !== expectedToken) {
    return NextResponse.redirect(new URL("/alert", req.url));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Check if session already exists
    const { data: existing } = await supabase
      .from("sessions")
      .select("id")
      .eq("created_by", parseInt(userId))
      .eq("spot_id", parseInt(spotId))
      .eq("session_date", date)
      .single();

    if (!existing) {
      // Create session
      await supabase.from("sessions").insert({
        created_by: parseInt(userId),
        spot_id: parseInt(spotId),
        session_date: date,
        alert_id: alertId ? parseInt(alertId) : null,
        status: "going",
        going_at: new Date().toISOString(),
        forecast_wind: wind ? parseInt(wind) : null,
        forecast_gust: gust ? parseInt(gust) : null,
        forecast_dir: dir || null,
      });
    }
  } catch (e) {
    console.error("Going link error:", e);
  }

  // Redirect to alert page
  return NextResponse.redirect(new URL("/alert", req.url));
}