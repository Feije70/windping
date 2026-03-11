import { NextRequest, NextResponse } from "next/server";

// Verstuurt nieuws-push naar gebruikers voor hun homespots
// Draait maandag 18:00 — na de nieuws-scan van 07:00
// Alleen spots met news_score >= 7 en news_push_blocked = false
// Gebruiker moet push_nieuws = true hebben in alert_preferences

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.windping.com";

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
    // 1. Haal spots op met nieuws score >= 7, niet geblokkeerd, nieuws aanwezig
    const enrichRes = await sbFetch(
      "spot_enrichment?news_score=gte.7&news_push_blocked=eq.false&select=spot_id,news_score,categories,scanned_at"
    );
    const enrichData = await enrichRes.json();
    if (!Array.isArray(enrichData) || enrichData.length === 0) {
      return NextResponse.json({ pushed: 0, message: "Geen spots met nieuws score >= 7" });
    }

    // Filter spots die daadwerkelijk nieuws hebben
    const spotsWithNews = enrichData.filter((e: any) => {
      const cats = e.categories || {};
      // Pak nl of en laag
      const layer = cats.nl || cats.en || cats;
      return layer?.news && layer.news.trim().length > 0;
    });

    if (spotsWithNews.length === 0) {
      return NextResponse.json({ pushed: 0, message: "Geen spots met nieuwsinhoud" });
    }

    const spotIds = spotsWithNews.map((e: any) => e.spot_id);

    // 2. Haal spot namen op
    const spotsRes = await sbFetch(
      `spots?id=in.(${spotIds.join(",")})&select=id,display_name,country`
    );
    const spotsData = await spotsRes.json();
    const spotMap: Record<number, any> = {};
    if (Array.isArray(spotsData)) {
      spotsData.forEach((s: any) => { spotMap[s.id] = s; });
    }

    // 3. Haal gebruikers op die push_nieuws aan hebben + push subscription hebben
    const userSpotsRes = await sbFetch(
      `user_spots?spot_id=in.(${spotIds.join(",")})&select=user_id,spot_id,is_homespot`
    );
    const userSpots = await userSpotsRes.json();
    if (!Array.isArray(userSpots) || userSpots.length === 0) {
      return NextResponse.json({ pushed: 0, message: "Geen gebruikers gevonden voor deze spots" });
    }

    // 4. Haal alert_preferences op voor gebruikers
    const userIds = [...new Set(userSpots.map((us: any) => us.user_id))];
    const prefsRes = await sbFetch(
      `alert_preferences?user_id=in.(${userIds.join(",")})&select=user_id,push_nieuws,notify_push`
    );
    const prefsData = await prefsRes.json();
    const prefsMap: Record<number, any> = {};
    if (Array.isArray(prefsData)) {
      prefsData.forEach((p: any) => { prefsMap[p.user_id] = p; });
    }

    // 5. Haal push subscriptions op
    const subsRes = await sbFetch(
      `push_subscriptions?user_id=in.(${userIds.join(",")})&select=user_id,subscription`
    );
    const subsData = await subsRes.json();
    const subsMap: Record<number, any[]> = {};
    if (Array.isArray(subsData)) {
      subsData.forEach((s: any) => {
        if (!subsMap[s.user_id]) subsMap[s.user_id] = [];
        subsMap[s.user_id].push(s.subscription);
      });
    }

    // 6. Stuur push per gebruiker per spot
    let totalPushed = 0;
    const pushLog: any[] = [];

    for (const userSpot of userSpots) {
      const { user_id, spot_id } = userSpot;
      const prefs = prefsMap[user_id];

      // Sla over als push_nieuws uit staat (default aan als kolom niet bestaat)
      if (prefs && prefs.push_nieuws === false) continue;
      if (prefs && prefs.notify_push === false) continue;

      const subs = subsMap[user_id];
      if (!subs || subs.length === 0) continue;

      const enrich = spotsWithNews.find((e: any) => e.spot_id === spot_id);
      if (!enrich) continue;

      const spot = spotMap[spot_id];
      const spotName = spot?.display_name || `Spot #${spot_id}`;
      const cats = enrich.categories || {};
      const isNL = spot?.country === "NL";
      const layer = isNL ? (cats.nl || cats.en || cats) : (cats.en || cats);
      const newsText = layer?.news || "";
      if (!newsText) continue;

      // Stuur push via /api/send-push
      const pushRes = await fetch(`${APP_URL}/api/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          title: `📰 Nieuws: ${spotName}`,
          body: newsText.length > 120 ? newsText.substring(0, 117) + "..." : newsText,
          url: `/spot?id=${spot_id}`,
        }),
      });

      if (pushRes.ok) {
        totalPushed++;
        pushLog.push({ user_id, spot_id, spot_name: spotName });
      }
    }

    // 7. Update last_news_push_at voor gepushte spots
    const pushedSpotIds = [...new Set(pushLog.map((p: any) => p.spot_id))];
    if (pushedSpotIds.length > 0) {
      await sbFetch(
        `spot_enrichment?spot_id=in.(${pushedSpotIds.join(",")})`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_news_push_at: new Date().toISOString() }),
        }
      );
    }

    return NextResponse.json({
      pushed: totalPushed,
      spots_with_news: spotsWithNews.length,
      push_log: pushLog,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}