import { NextRequest, NextResponse } from "next/server";

// Maakt wekelijks news_update jobs aan voor actieve spots MET bestaand enrichment record
// Spots zonder enrichment record worden overgeslagen (handmatig scannen via admin)
// Stel in op cron-job.org: elke maandag 07:00
// URL: https://www.windping.com/api/enrichment-news-trigger?key=WindPing-cron-key-2026

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wxnpevwjgacxovnzxkxl.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function sbFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Haal alle spot_ids op die minimaal 1 gebruiker hebben
    const res = await sbFetch("user_spots?select=spot_id");
    const rows = await res.json() as { spot_id: number }[];
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "user_spots ophalen mislukt" }, { status: 500 });
    }

    const spotIds = [...new Set(rows.map(r => r.spot_id))];
    if (spotIds.length === 0) {
      return NextResponse.json({ queued: 0, message: "Geen actieve spots gevonden" });
    }

    // 2. Check welke spots al een enrichment record hebben
    const enrichRes = await sbFetch(
      `spot_enrichment?spot_id=in.(${spotIds.join(",")})&select=spot_id`
    );
    const enrichData = await enrichRes.json() as { spot_id: number }[];
    const alreadyEnriched = new Set(
      Array.isArray(enrichData) ? enrichData.map(r => r.spot_id) : []
    );

    const enrichedSpotIds = spotIds.filter(id => alreadyEnriched.has(id));
    const skipped = spotIds.length - enrichedSpotIds.length;

    if (enrichedSpotIds.length === 0) {
      return NextResponse.json({ queued: 0, skipped, message: "Geen gescande spots gevonden — scan eerst handmatig via admin" });
    }

    // 3. Check welke al een pending/running job hebben
    const existingRes = await sbFetch(
      `enrichment_jobs?status=in.(pending,running)&job_type=eq.news_update&select=spot_id`
    );
    const existingJobs = await existingRes.json() as { spot_id: number }[];
    const alreadyQueued = new Set(
      Array.isArray(existingJobs) ? existingJobs.map(j => j.spot_id) : []
    );

    const toQueue = enrichedSpotIds.filter(id => !alreadyQueued.has(id));
    if (toQueue.length === 0) {
      return NextResponse.json({ queued: 0, skipped, message: "Alle gescande spots staan al in de wachtrij" });
    }

    // 4. Maak news_update jobs aan
    const jobs = toQueue.map(spot_id => ({
      spot_id,
      job_type: "news_update",
      status: "pending",
    }));

    const insertRes = await sbFetch("enrichment_jobs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(jobs),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return NextResponse.json({ error: `Insert mislukt: ${insertRes.status} — ${err}` }, { status: 500 });
    }

    return NextResponse.json({
      queued: toQueue.length,
      skipped_no_enrichment: skipped,
      already_queued: enrichedSpotIds.length - toQueue.length,
      total_active_spots: spotIds.length,
    });

  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}