import { NextRequest, NextResponse } from "next/server";

// Maakt wekelijks news_update jobs aan voor alle actieve spots (≥1 user in user_spots)
// Stel in op cron-job.org: elke maandag 07:00
// URL: https://www.windping.com/api/enrichment-news-trigger?key=WindPing-cron-key-2026

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";

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
    // Haal alle spot_ids op die minimaal 1 gebruiker hebben
    const res = await sbFetch("user_spots?select=spot_id");
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "user_spots ophalen mislukt" }, { status: 500 });
    }

    // Unieke spot_ids
    const spotIds = [...new Set(rows.map((r: any) => r.spot_id))] as number[];

    if (spotIds.length === 0) {
      return NextResponse.json({ queued: 0, message: "Geen actieve spots gevonden" });
    }

    // Maak news_update job aan voor elke actieve spot
    // (alleen als er nog geen pending/running news_update job is voor die spot)
    const existingRes = await sbFetch(
      `enrichment_jobs?status=in.(pending,running)&job_type=eq.news_update&select=spot_id`
    );
    const existingJobs = await existingRes.json();
    const alreadyQueued = new Set(
      Array.isArray(existingJobs) ? existingJobs.map((j: any) => j.spot_id) : []
    );

    const toQueue = spotIds.filter(id => !alreadyQueued.has(id));

    if (toQueue.length === 0) {
      return NextResponse.json({ queued: 0, message: "Alle actieve spots staan al in de wachtrij" });
    }

    // Batch insert jobs
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
      total_active_spots: spotIds.length,
      already_queued: spotIds.length - toQueue.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
