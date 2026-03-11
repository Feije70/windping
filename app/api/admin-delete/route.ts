import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_KEY = "WindPing-cron-key-2026";

async function sbDelete(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = searchParams.get("type");

  try {
    if (type === "enrichment") {
      const spotId = searchParams.get("spot_id");
      if (!spotId) return NextResponse.json({ error: "spot_id required" }, { status: 400 });
      await sbDelete(`spot_enrichment?spot_id=eq.${spotId}`);
      return NextResponse.json({ ok: true });
    }

    if (type === "spot") {
      const spotId = searchParams.get("spot_id");
      if (!spotId) return NextResponse.json({ error: "spot_id required" }, { status: 400 });
      await Promise.all([
        sbDelete(`spot_enrichment?spot_id=eq.${spotId}`),
        sbDelete(`ideal_conditions?spot_id=eq.${spotId}`),
        sbDelete(`user_spots?spot_id=eq.${spotId}`),
        sbDelete(`spot_posts?spot_id=eq.${spotId}`),
        sbDelete(`enrichment_jobs?spot_id=eq.${spotId}`),
      ]);
      await sbDelete(`spots?id=eq.${spotId}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "onbekend type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}