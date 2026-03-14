import { NextRequest, NextResponse } from "next/server";

// Maakt full_scan jobs aan — handmatig via admin of jaarlijkse cron
// Modi:
//   ?mode=new_only  → alleen spots zonder bestaande enrichment (default)
//   ?mode=active    → alle spots met ≥1 gebruiker (jaarlijkse refresh)
//   ?mode=all       → alle spots (volledig herindexeren, gebruik spaarzaam)
// Optioneel: &limit=10     → max N spots queuen
// Optioneel: &country=NL  → alleen spots van dit land
// Voorbeeld: /api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=new_only&limit=10&country=NL

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
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

  const mode = searchParams.get("mode") || "new_only";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : null;
  const country = searchParams.get("country") || null;

  try {
    let spotIds: number[] = [];

    const spotsQuery = country
      ? `spots?select=id&country=eq.${country}`
      : `spots?select=id&country=not.is.null`;

    if (mode === "new_only") {
      const [spotsRes, enrichRes] = await Promise.all([
        sbFetch(spotsQuery).then(r => r.json()) as Promise<{ id: number }[]>,
        sbFetch("spot_enrichment?select=spot_id").then(r => r.json()) as Promise<{ spot_id: number }[]>,
      ]);
      const allSpotIds = new Set(Array.isArray(spotsRes) ? spotsRes.map(s => s.id) : []);
      const enrichedIds = new Set(Array.isArray(enrichRes) ? enrichRes.map(e => e.spot_id) : []);
      spotIds = [...allSpotIds].filter(id => !enrichedIds.has(id));

    } else if (mode === "active") {
      const [userSpotsRes, spotsRes] = await Promise.all([
        sbFetch("user_spots?select=spot_id").then(r => r.json()) as Promise<{ spot_id: number }[]>,
        sbFetch(spotsQuery).then(r => r.json()) as Promise<{ id: number }[]>,
      ]);
      const userSpotIds = new Set(Array.isArray(userSpotsRes) ? userSpotsRes.map(r => r.spot_id) : []);
      const countrySpotIds = new Set(Array.isArray(spotsRes) ? spotsRes.map(s => s.id) : []);
      spotIds = [...userSpotIds].filter(id => countrySpotIds.has(id));

    } else if (mode === "all") {
      const res = await sbFetch(spotsQuery);
      const rows = await res.json() as { id: number }[];
      spotIds = Array.isArray(rows) ? rows.map(r => r.id) : [];
    }

    if (spotIds.length === 0) {
      return NextResponse.json({ queued: 0, message: `Geen spots gevonden voor mode: ${mode}${country ? `, country: ${country}` : ""}` });
    }

    const existingRes = await sbFetch(
      `enrichment_jobs?status=in.(pending,running)&job_type=eq.full_scan&select=spot_id`
    );
    const existingJobs = await existingRes.json() as { spot_id: number }[];
    const alreadyQueued = new Set(Array.isArray(existingJobs) ? existingJobs.map(j => j.spot_id) : []);

    const toQueue = spotIds.filter(id => !alreadyQueued.has(id));
    const toQueueLimited = limit ? toQueue.slice(0, limit) : toQueue;

    if (toQueueLimited.length === 0) {
      return NextResponse.json({ queued: 0, message: "Alle spots staan al in de wachtrij" });
    }

    const jobs = toQueueLimited.map(spot_id => ({
      spot_id,
      job_type: "full_scan",
      status: "pending",
    }));

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
      spot_ids: toQueueLimited,
      mode,
      country: country || "all",
      total_spots: spotIds.length,
      already_queued: spotIds.length - toQueue.length,
      limit_applied: limit,
    });

  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}