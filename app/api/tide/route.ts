/* ── app/api/tide/route.ts ────────────────────────────────────
   Server-side proxy for Stormglass tide API.
   Caches results in Supabase tide_cache table.
   
   Usage: GET /api/tide?spot_id=123&lat=52.1&lng=4.3&type=sea_level
   Types: "sea_level" (hourly heights, 24h) or "extremes" (HW/LW times, 7 days)
   
   Requires env vars:
     STORMGLASS_API_KEY=your_key_here
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";

const STORMGLASS_KEY = process.env.STORMGLASS_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthaW1idGN1eWVtd3p2aHNxd2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTM0NzgsImV4cCI6MjA4NjcyOTQ3OH0.EVX_hJYy_uJ_-rk-q5izn_6qzo5TbHCnS4llbVUM4Q0";

// Cache durations
const SEA_LEVEL_CACHE_HOURS = 1;    // Refresh every hour (includes weather influence)
const EXTREMES_CACHE_HOURS = 24;     // HW/LW times are stable, refresh daily

async function sbFetch(path: string, options?: { method?: string; body?: unknown; token?: string }) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spotId = searchParams.get("spot_id");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const dataType = searchParams.get("type") || "sea_level"; // "sea_level" or "extremes"
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!spotId || !lat || !lng) {
    return NextResponse.json({ error: "Missing spot_id, lat, or lng" }, { status: 400 });
  }

  if (!STORMGLASS_KEY) {
    return NextResponse.json({ error: "Stormglass API key not configured" }, { status: 500 });
  }

  // 1. Check cache
  try {
    const cached = await sbFetch(
      `tide_cache?spot_id=eq.${spotId}&data_type=eq.${dataType}&select=*`,
      { token: token || undefined }
    );

    if (cached && cached.length > 0) {
      const entry = cached[0];
      const validUntil = new Date(entry.valid_until);
      if (validUntil > new Date()) {
        // Cache is still valid
        return NextResponse.json({
          data: entry.data,
          station: { name: entry.station_name, distance_km: entry.station_distance_km },
          cached: true,
          valid_until: entry.valid_until,
        });
      }
    }
  } catch (e) {
    console.warn("Cache check failed:", e);
  }

  // 2. Fetch from Stormglass
  try {
    const now = new Date();
    let url: string;

    if (dataType === "extremes") {
      // HW/LW times for 7 days
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      url = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${now.toISOString()}&end=${end.toISOString()}`;
    } else {
      // Sea level hour by hour for 24 hours
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      url = `https://api.stormglass.io/v2/tide/sea-level/point?lat=${lat}&lng=${lng}&start=${now.toISOString()}&end=${end.toISOString()}`;
    }

    const sgRes = await fetch(url, {
      headers: { Authorization: STORMGLASS_KEY },
    });

    if (!sgRes.ok) {
      const errText = await sgRes.text();
      console.error("Stormglass error:", sgRes.status, errText);
      return NextResponse.json({ error: "Stormglass API error", status: sgRes.status }, { status: 502 });
    }

    const sgData = await sgRes.json();

    // Extract station info from meta
    const stationName = sgData.meta?.station?.name || null;
    const stationDistance = sgData.meta?.station?.distance ? Math.round(sgData.meta.station.distance / 1000 * 10) / 10 : null;

    // 3. Store in cache
    const cacheHours = dataType === "extremes" ? EXTREMES_CACHE_HOURS : SEA_LEVEL_CACHE_HOURS;
    const validUntil = new Date(now.getTime() + cacheHours * 60 * 60 * 1000).toISOString();

    try {
      // Upsert: insert or update if exists
      await sbFetch(
        `tide_cache?on_conflict=spot_id,data_type`,
        {
          method: "POST",
          body: {
            spot_id: parseInt(spotId),
            data_type: dataType,
            fetched_at: now.toISOString(),
            valid_until: validUntil,
            data: sgData.data || sgData,
            station_name: stationName,
            station_distance_km: stationDistance,
          },
          token: token || undefined,
        }
      );
    } catch (e) {
      console.warn("Cache write failed (non-fatal):", e);
    }

    // 4. Return fresh data
    return NextResponse.json({
      data: sgData.data || sgData,
      station: { name: stationName, distance_km: stationDistance },
      cached: false,
      valid_until: validUntil,
    });

  } catch (e) {
    console.error("Stormglass fetch error:", e);
    return NextResponse.json({ error: "Failed to fetch tide data" }, { status: 500 });
  }
}