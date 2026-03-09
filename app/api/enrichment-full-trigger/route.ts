import { NextRequest, NextResponse } from "next/server";

// Maakt full_scan jobs aan — handmatig via admin of jaarlijkse cron
// Twee modi:
//   ?mode=new_only  → alleen spots zonder bestaande enrichment (default)
//   ?mode=active    → alle spots met ≥1 gebruiker (jaarlijkse refresh)
//   ?mode=all       → alle spots (volledig herindexeren, gebruik spaarzaam)
// URL: https://www.windping.com/api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=new_only

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

  const mode = searchParams.get("mode") || "new_only";

  try {
    let spotIds: number[] = [];

    if (mode === "new_only") {
      // Spots zonder bestaande enrichment
      const [spotsRes, enrichRes] = await Promise.all([
        sbFetch("spots?select=id").then(r => r.json()),
        sbFetch("spot_enrichment?select=spot_id").then(r => r.json()),
      ]);
      const allSpotIds = new Set(
        Array.isArray(spotsRes) ? spotsRes.map((s: any) => s.id) : []
      );
      const enrichedIds = new Set(
        Array.isArray(enrichRes) ? enrichRes.map((e: any) => e.spot_id) : []
      );
      spotIds = [...allSpotIds].filter(id => !enrichedIds.has(id));

    } else if (mode === "active") {
      // Alleen spots met ≥1 gebruiker
      const res = await sbFetch("user_spots?select=spot_id");
      const rows = await res.json();
      spotIds = [...new Set(
        Array.isArray(rows) ? rows.map((r: any) => r.spot_id) : []
      )] as number[];

    } else if (mode === "all") {
      // Alle spots
      const res = await sbFetch("spots?select=id");
      const rows = await res.json();
      spotIds = Array.isArray(rows) ? rows.map((r: any) => r.id) : [];
    }

    if (spotIds.length === 0) {
      return NextResponse.json({ queued: 0, message: `Geen spots gevonden voor mode: ${mode}` });
    }

    // Skip spots die al een pending/running full_scan job hebben
    const existingRes = await sbFetch(
      `enrichment_jobs?status=in.(pending,running)&job_type=eq.full_scan&select=spot_id`
    );
    const existingJobs = await existingRes.json();
    const alreadyQueued = new Set(
      Array.isArray(existingJobs) ? existingJobs.map((j: any) => j.spot_id) : []
    );

    const toQueue = spotIds.filter(id => !alreadyQueued.has(id));

    if (toQueue.length === 0) {
      return NextResponse.json({ queued: 0, message: "Alle spots staan al in de wachtrij" });
    }

    // Batch insert — Supabase accepteert arrays
    const jobs = toQueue.map(spot_id => ({
      spot_id,
      job_type: "full_scan",
      status: "pending",
    }));

    // Insert in batches van 500 (Supabase limiet)
    const BATCH = 500;
    let totalInserted = 0;
    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);
      const insertRes = await sbFetch("enrichment_jobs", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(batch),
      });
      if (insertRes.ok) totalInserted += batch.length;
    }

    return NextResponse.json({
      queued: totalInserted,
      mode,
      total_spots: spotIds.length,
      already_queued: spotIds.length - toQueue.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
