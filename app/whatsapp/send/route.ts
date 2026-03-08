/* ── app/api/whatsapp/send/route.ts ─────────────────────────
   WindPing WhatsApp alerts via Bird Channels API
   
   Vereiste env vars:
   - BIRD_API_KEY          → Bird access key
   - BIRD_WORKSPACE_ID     → 1bf032f1-da8e-4650-aa73-5bec874f65b9
   - BIRD_CHANNEL_ID       → WhatsApp channel UUID (na koppeling)
   - BIRD_TEMPLATE_PROJECT_ID → Template project UUID (na goedkeuring)
   ──────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const BIRD_API_KEY = process.env.BIRD_API_KEY || "";
const BIRD_WORKSPACE_ID = process.env.BIRD_WORKSPACE_ID || "1bf032f1-da8e-4650-aa73-5bec874f65b9";
const BIRD_CHANNEL_ID = process.env.BIRD_CHANNEL_ID || "";
const BIRD_TEMPLATE_PROJECT_ID = process.env.BIRD_TEMPLATE_PROJECT_ID || "";

/* ── Stuur WhatsApp template bericht via Bird ── */
async function sendWhatsAppAlert({
  phoneNumber,
  spotName,
  wind,
  dagdeel,
  date,
}: {
  phoneNumber: string;
  spotName: string;
  wind: string;
  dagdeel: string;
  date: string;
}) {
  const url = `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_CHANNEL_ID}/messages`;

  const body = {
    receiver: {
      contacts: [
        {
          identifierKey: "phonenumber",
          identifierValue: phoneNumber,
        },
      ],
    },
    template: {
      projectId: BIRD_TEMPLATE_PROJECT_ID,
      version: "latest",
      locale: "nl",
      parameters: [
        // {{1}} in kop = spotName
        { type: "string", key: "1", value: spotName },
        // {{1}} in tekst = wind (bv "6kn NNW")
        { type: "string", key: "body_1", value: wind },
        // {{2}} in tekst = spotName
        { type: "string", key: "body_2", value: spotName },
        // {{3}} in tekst = dagdeel (bv "middag")
        { type: "string", key: "body_3", value: dagdeel },
        // {{4}} in tekst = datum (bv "maandag 9 maart")
        { type: "string", key: "body_4", value: date },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `AccessKey ${BIRD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bird API error ${response.status}: ${error}`);
  }

  return response.json();
}

/* ── POST handler ── */
export async function POST(req: Request) {
  // Verify cron secret or admin
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";

  if (authHeader !== `Bearer ${cronSecret}`) {
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

  if (!BIRD_API_KEY || !BIRD_CHANNEL_ID || !BIRD_TEMPLATE_PROJECT_ID) {
    return NextResponse.json({ error: "Bird not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { userId, spotName, wind, dagdeel, date } = body;

  if (!userId || !spotName || !wind || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Haal telefoonnummer op van gebruiker
  const { data: user } = await sb
    .from("users")
    .select("phone, whatsapp_alerts")
    .eq("id", userId)
    .single();

  if (!user?.phone) {
    return NextResponse.json({ sent: 0, reason: "no phone number" });
  }

  if (user.whatsapp_alerts === false) {
    return NextResponse.json({ sent: 0, reason: "whatsapp alerts disabled" });
  }

  // Normaliseer telefoonnummer naar internationaal formaat
  let phoneNumber = user.phone.replace(/\s/g, "");
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "+31" + phoneNumber.slice(1);
  }
  if (!phoneNumber.startsWith("+")) {
    phoneNumber = "+" + phoneNumber;
  }

  try {
    await sendWhatsAppAlert({
      phoneNumber,
      spotName,
      wind,
      dagdeel: dagdeel || "hele dag",
      date,
    });

    return NextResponse.json({ sent: 1 });
  } catch (e: any) {
    console.error("WhatsApp send failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}