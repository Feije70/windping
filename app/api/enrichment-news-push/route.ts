import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wxnpevwjgacxovnzxkxl.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.windping.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "feijekooistra@hotmail.com";

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

function getNewsText(enrich: any, spot: any): string {
  const cats = enrich.categories || {};
  const isNL = spot?.country === "NL" || spot?.country === "Netherlands" || spot?.country === "Nederland";
  const layer = isNL ? (cats.nl || cats.en || cats) : (cats.en || cats.nl || cats);
  return layer?.news || "";
}

function scoreLabel(score: number): string {
  if (score >= 9) return "🔥 Zeer relevant";
  if (score >= 7) return "✅ Relevant";
  if (score >= 5) return "🟡 Matig";
  return "⬇️ Laag";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sendEmail = searchParams.get("email") !== "false";

  try {
    // 1. Haal alle spots op met nieuws-score (alle scores, voor overzicht-email)
    const enrichRes = await sbFetch(
      "spot_enrichment?news_score=not.is.null&select=spot_id,news_score,news_push_blocked,categories,scanned_at,last_news_push_at&order=news_score.desc"
    );
    const enrichData = await enrichRes.json();
    if (!Array.isArray(enrichData) || enrichData.length === 0) {
      return NextResponse.json({ pushed: 0, message: "Geen spots met nieuws score" });
    }

    // Filter op spots met daadwerkelijke nieuwstekst
    const spotsWithScore = enrichData.filter((e: any) => {
      const cats = e.categories || {};
      const layer = cats.nl || cats.en || cats;
      return layer?.news && layer.news.trim().length > 10;
    });

    if (spotsWithScore.length === 0) {
      return NextResponse.json({ pushed: 0, message: "Geen spots met nieuwsinhoud" });
    }

    const spotIds = spotsWithScore.map((e: any) => e.spot_id);

    // 2. Haal spot namen op
    const spotsRes = await sbFetch(`spots?id=in.(${spotIds.join(",")})&select=id,display_name,country,region`);
    const spotsData = await spotsRes.json();
    const spotMap: Record<number, any> = {};
    if (Array.isArray(spotsData)) spotsData.forEach((s: any) => { spotMap[s.id] = s; });

    // Splits: te pushen (score >= 7, niet geblokkeerd) vs gefilterd
    const tePushen = spotsWithScore.filter((e: any) => (e.news_score || 0) >= 7 && !e.news_push_blocked);
    const geblokkeerd = spotsWithScore.filter((e: any) => e.news_push_blocked);
    const telaagScore = spotsWithScore.filter((e: any) => (e.news_score || 0) < 7 && !e.news_push_blocked);

    const pushSpotIds = tePushen.map((e: any) => e.spot_id);

    // 3. Haal gebruikers op voor te-pushen spots
    let totalPushed = 0;
    const pushLog: any[] = [];

    if (pushSpotIds.length > 0) {
      const userSpotsRes = await sbFetch(`user_spots?spot_id=in.(${pushSpotIds.join(",")})&select=user_id,spot_id`);
      const userSpots = await userSpotsRes.json();

      if (Array.isArray(userSpots) && userSpots.length > 0) {
        const userIds = [...new Set(userSpots.map((us: any) => us.user_id))];

        const prefsRes = await sbFetch(`alert_preferences?user_id=in.(${userIds.join(",")})&select=user_id,push_nieuws,notify_push`);
        const prefsData = await prefsRes.json();
        const prefsMap: Record<number, any> = {};
        if (Array.isArray(prefsData)) prefsData.forEach((p: any) => { prefsMap[p.user_id] = p; });

        const subsRes = await sbFetch(`push_subscriptions?user_id=in.(${userIds.join(",")})&select=user_id,subscription`);
        const subsData = await subsRes.json();
        const subsMap: Record<number, any[]> = {};
        if (Array.isArray(subsData)) {
          subsData.forEach((s: any) => {
            if (!subsMap[s.user_id]) subsMap[s.user_id] = [];
            subsMap[s.user_id].push(s.subscription);
          });
        }

        for (const userSpot of userSpots) {
          const { user_id, spot_id } = userSpot;
          const prefs = prefsMap[user_id];
          if (prefs?.push_nieuws === false) continue;
          if (prefs?.notify_push === false) continue;
          const subs = subsMap[user_id];
          if (!subs || subs.length === 0) continue;

          const enrich = tePushen.find((e: any) => e.spot_id === spot_id);
          if (!enrich) continue;
          const spot = spotMap[spot_id];
          const newsText = getNewsText(enrich, spot);
          if (!newsText) continue;
          const spotName = spot?.display_name || `Spot #${spot_id}`;

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
      }
    }

    // 4. Update last_news_push_at voor gepushte spots
    const pushedSpotIds = [...new Set(pushLog.map((p: any) => p.spot_id))];
    if (pushedSpotIds.length > 0) {
      await sbFetch(`spot_enrichment?spot_id=in.(${pushedSpotIds.join(",")})`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_news_push_at: new Date().toISOString() }),
      });
    }

    // 5. Reset: news_score = null + news_push_blocked = false voor alle spots met score
    // Zodat volgende maandag schoon begint
    await sbFetch(`spot_enrichment?news_score=not.is.null`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ news_score: null, news_push_blocked: false }),
    });

    // 6. Stuur overzicht-email naar admin
    if (sendEmail && RESEND_API_KEY && spotsWithScore.length > 0) {
      const datumStr = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

      // Bouw HTML email
      const rowsGepusht = tePushen.map((e: any) => {
        const spot = spotMap[e.spot_id];
        const news = getNewsText(e, spot);
        return `
          <tr style="border-bottom:1px solid #E8E0D8">
            <td style="padding:10px 12px;font-weight:700;color:#1F354C">${spot?.display_name || e.spot_id}</td>
            <td style="padding:10px 12px;text-align:center"><span style="background:#ECFAF4;color:#065F46;font-weight:700;padding:3px 8px;border-radius:5px">${e.news_score}</span></td>
            <td style="padding:10px 12px;color:#444;font-size:13px">${news.substring(0, 200)}${news.length > 200 ? "..." : ""}</td>
          </tr>`;
      }).join("");

      const rowsGefilterd = telaagScore.map((e: any) => {
        const spot = spotMap[e.spot_id];
        const news = getNewsText(e, spot);
        return `
          <tr style="border-bottom:1px solid #E8E0D8;opacity:0.8">
            <td style="padding:10px 12px;font-weight:600;color:#6B7B8F">${spot?.display_name || e.spot_id}</td>
            <td style="padding:10px 12px;text-align:center"><span style="background:#FEF3C7;color:#92400E;font-weight:700;padding:3px 8px;border-radius:5px">${e.news_score}</span></td>
            <td style="padding:10px 12px;color:#888;font-size:13px">${news.substring(0, 200)}${news.length > 200 ? "..." : ""}</td>
          </tr>`;
      }).join("");

      const rowsGeblokkeerd = geblokkeerd.map((e: any) => {
        const spot = spotMap[e.spot_id];
        return `
          <tr style="border-bottom:1px solid #E8E0D8;opacity:0.6">
            <td style="padding:10px 12px;font-weight:600;color:#9CA3AF">${spot?.display_name || e.spot_id}</td>
            <td style="padding:10px 12px;text-align:center"><span style="background:#FEE2E2;color:#DC2626;font-weight:700;padding:3px 8px;border-radius:5px">${e.news_score}</span></td>
            <td style="padding:10px 12px;color:#9CA3AF;font-size:13px">🔕 Geblokkeerd door admin</td>
          </tr>`;
      }).join("");

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#F6F1EB;padding:24px">
          <div style="background:#1F354C;padding:20px 24px;border-radius:12px 12px 0 0">
            <div style="color:#fff;font-size:22px;font-weight:800">WindPing — Nieuws push overzicht</div>
            <div style="color:#8AB0C8;font-size:13px;margin-top:4px">${datumStr} — push verstuurd om 18:00</div>
          </div>
          <div style="background:#fff;padding:20px 24px;border-radius:0 0 12px 12px">

            <div style="display:flex;gap:16px;margin-bottom:20px">
              <div style="flex:1;background:#ECFAF4;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#065F46">${tePushen.length}</div>
                <div style="font-size:12px;color:#6B7B8F;margin-top:4px">Gepusht (score ≥ 7)</div>
              </div>
              <div style="flex:1;background:#FEF3C7;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#92400E">${telaagScore.length}</div>
                <div style="font-size:12px;color:#6B7B8F;margin-top:4px">Gefilterd (score &lt; 7)</div>
              </div>
              <div style="flex:1;background:#FEE2E2;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#DC2626">${geblokkeerd.length}</div>
                <div style="font-size:12px;color:#6B7B8F;margin-top:4px">Geblokkeerd</div>
              </div>
              <div style="flex:1;background:#EFF8FB;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#2E8FAE">${totalPushed}</div>
                <div style="font-size:12px;color:#6B7B8F;margin-top:4px">Push notificaties</div>
              </div>
            </div>

            ${tePushen.length > 0 ? `
            <h3 style="color:#1F354C;font-size:14px;font-weight:800;margin:20px 0 8px">✅ Gepusht naar gebruikers</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#F6F1EB">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">SPOT</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B7B8F">SCORE</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">NIEUWS</th>
              </tr></thead>
              <tbody>${rowsGepusht}</tbody>
            </table>` : ""}

            ${telaagScore.length > 0 ? `
            <h3 style="color:#1F354C;font-size:14px;font-weight:800;margin:20px 0 8px">🟡 Niet gepusht (score &lt; 7)</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#F6F1EB">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">SPOT</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B7B8F">SCORE</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">NIEUWS</th>
              </tr></thead>
              <tbody>${rowsGefilterd}</tbody>
            </table>` : ""}

            ${geblokkeerd.length > 0 ? `
            <h3 style="color:#1F354C;font-size:14px;font-weight:800;margin:20px 0 8px">🔕 Geblokkeerd door admin</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#F6F1EB">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">SPOT</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B7B8F">SCORE</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7B8F">REDEN</th>
              </tr></thead>
              <tbody>${rowsGeblokkeerd}</tbody>
            </table>` : ""}

            <div style="margin-top:24px;padding:14px;background:#EFF8FB;border-radius:8px;font-size:12px;color:#2E8FAE">
              Scores zijn gereset. Volgende maandag begint de scan opnieuw schoon.
            </div>
          </div>
        </div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "WindPing <noreply@windping.com>",
          to: [ADMIN_EMAIL],
          subject: `WindPing nieuws push — ${tePushen.length} spots gepusht (${datumStr})`,
          html: emailHtml,
        }),
      });
    }

    return NextResponse.json({
      pushed: totalPushed,
      spots_gepusht: tePushen.length,
      spots_gefilterd: telaagScore.length,
      spots_geblokkeerd: geblokkeerd.length,
      reset_done: true,
      email_sent: sendEmail && !!RESEND_API_KEY,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
