import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // Vercel Pro: 5 minuten

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.windping.com";

// Minimale tijd tussen nieuws-pushes per spot (14 dagen)
const MIN_PUSH_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

// ── Taal helpers ─────────────────────────────────────────────

const REGION_LANG: Record<string, string> = {
  Spain: "es", Germany: "de", France: "fr", Italy: "it",
  Portugal: "pt", Greece: "el", Denmark: "da", Ireland: "en",
  Croatia: "hr", Norway: "no", Sweden: "sv", Belgium: "nl",
  Poland: "pl", Morocco: "ar", Bulgaria: "bg", Turkey: "tr",
  Austria: "de", Switzerland: "de", Latvia: "lv", Romania: "ro",
  Hungary: "hu", Montenegro: "sr", Azores: "pt", Wales: "en",
  England: "en", Scotland: "en",
};

const LANG_NAME: Record<string, string> = {
  nl: "Dutch", en: "English", de: "German", fr: "French",
  es: "Spanish", pt: "Portuguese", it: "Italian", el: "Greek",
  da: "Danish", hr: "Croatian", no: "Norwegian", sv: "Swedish",
  pl: "Polish", ar: "Arabic", bg: "Bulgarian", tr: "Turkish",
  lv: "Latvian", ro: "Romanian", hu: "Hungarian", sr: "Serbian",
};

function getLangForSpot(region: string | undefined): string {
  if (!region) return "nl";
  const parts = region.split(", ");
  if (parts.length < 2) return "nl";
  const country = parts[parts.length - 1];
  return REGION_LANG[country] || "en";
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Supabase helper ──────────────────────────────────────────

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

// ── Anthropic helper ─────────────────────────────────────────

const SYSTEM = `You are a researcher for a kitesurfing/windsurfing app called WindPing.
Use web_search to find current information about the given spot.
Be specific and factual — never invent information.
ALWAYS respond with valid JSON only, no markdown, no explanation.`;

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const tools = [{ type: "web_search_20250305", name: "web_search" }];
  let messages: any[] = [{ role: "user", content: prompt }];

  const res1 = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: SYSTEM,
      tools,
      messages,
    }),
  });

  if (!res1.ok) throw new Error(`Anthropic fout: ${res1.status} — ${await res1.text()}`);
  const data1 = await res1.json();

  let finalData = data1;

  if (data1.stop_reason === "tool_use") {
    const toolUseBlocks = data1.content.filter((b: any) => b.type === "tool_use");
    messages = [
      { role: "user", content: prompt },
      { role: "assistant", content: data1.content },
      {
        role: "user",
        content: toolUseBlocks.map((b: any) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: `Search results for "${b.input?.query || ""}" have been processed.`,
        })),
      },
    ];

    const res2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: Math.floor(maxTokens / 2),
        system: SYSTEM,
        tools,
        messages,
      }),
    });

    if (!res2.ok) throw new Error(`Anthropic fout ronde 2: ${res2.status} — ${await res2.text()}`);
    finalData = await res2.json();
  }

  const textBlocks = finalData.content?.filter((b: any) => b.type === "text") || [];
  const fullText = textBlocks.map((b: any) => b.text).join("");
  const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Geen JSON in response. Raw: ${fullText.slice(0, 300)}`);
  return jsonMatch[0];
}

// ── STROOM 1: Full scan ──────────────────────────────────────

async function runFullScan(spot: any): Promise<{
  categories: any;
  confidence: number;
  sources: string[];
  missing: string[];
}> {
  const spotLang = getLangForSpot(spot.region);
  const spotLangName = LANG_NAME[spotLang] || "English";
  const needsBothLangs = spotLang !== "en";

  const locationHint = spot.region
    ? ` in ${spot.region}`
    : spot.latitude && spot.longitude
      ? ` (coordinates: ${spot.latitude.toFixed(3)}, ${spot.longitude.toFixed(3)})`
      : "";

  const langInstruction = needsBothLangs
    ? `Write all category values TWICE: once in ${spotLangName} (key: "${spotLang}") and once in English (key: "en").`
    : `Write all category values in English (key: "en").`;

  const categoryFields = `{
    "conditions": "Wind conditions, directions, best season, wave height, currents, water type. Null if unknown.",
    "facilities": "Parking, toilets, showers, food, kite school, rental. Null if unknown.",
    "hazards": "Hazards: rocks, currents, shipping, restricted zones, rules. Null if unknown.",
    "tips": "Practical tips from experienced surfers, best launch spot, local knowledge. Null if unknown.",
    "events": "Kite/windsurf competitions, festivals, markets, events affecting crowding. Null if unknown.",
    "news": "Recent news: beach closures, new rules, construction, upcoming major events. Null if unknown."
  }`;

  const jsonStructure = needsBothLangs
    ? `{ "confidence": 0.0-1.0, "sources": ["URLs used"], "categories": { "${spotLang}": ${categoryFields}, "en": ${categoryFields} }, "missing": ["unfound categories"] }`
    : `{ "confidence": 0.0-1.0, "sources": ["URLs used"], "categories": { "en": ${categoryFields} }, "missing": ["unfound categories"] }`;

  const prompt = `Find information about the kitesurfing/windsurfing spot: "${spot.display_name}"${locationHint}.

Use web_search to find current info. Search for:
- "${spot.display_name} kitesurf" or "${spot.display_name} windsurf"
- "${spot.display_name} beach facilities"
- "${spot.display_name} news ${new Date().getFullYear()}"

${langInstruction}

Respond with JSON:
${jsonStructure}`;

  const json = await callAnthropic(prompt, needsBothLangs ? 8000 : 5000);
  return JSON.parse(json);
}

// ── STROOM 2: News update ────────────────────────────────────

async function runNewsUpdate(spot: any, existingEnrichment: any): Promise<{
  news_changed: boolean;
  new_news: string | null;
  new_news_en: string | null;
  sources: string[];
}> {
  const spotLang = getLangForSpot(spot.region);
  const spotLangName = LANG_NAME[spotLang] || "English";
  const needsBothLangs = spotLang !== "en";

  const existingCats = existingEnrichment?.categories || {};
  const primaryCats = existingCats[spotLang] || existingCats["en"] || {};
  const currentNews = primaryCats.news || null;

  const locationHint = spot.region ? ` in ${spot.region}` : "";

  const langInstruction = needsBothLangs
    ? `If news has changed, write the new news TWICE: once in ${spotLangName} (key: "new_news") and once in English (key: "new_news_en").`
    : `If news has changed, write the new news in English (key: "new_news_en"). Set "new_news" to null.`;

  const currentNewsSection = currentNews
    ? `Current stored news:\n"${currentNews}"\n\nOnly report news_changed: true if there is genuinely NEW information not already covered above.`
    : `There is no current news stored for this spot.`;

  const prompt = `Check for recent news about the kitesurfing/windsurfing spot: "${spot.display_name}"${locationHint}.

Use web_search to find news from the last 4 weeks:
- "${spot.display_name} nieuws ${new Date().getFullYear()}"
- "${spot.display_name} news ${new Date().getFullYear()}"
- "${spot.display_name} strand regels"

${currentNewsSection}

${langInstruction}

Respond with JSON:
{
  "news_changed": true or false,
  "new_news": "updated news text in ${spotLangName}, or null if unchanged/not applicable",
  "new_news_en": "updated news text in English, or null if unchanged",
  "sources": ["URLs used"]
}`;

  const json = await callAnthropic(prompt, 2000);
  return JSON.parse(json);
}

// ── Push notification sturen ─────────────────────────────────

async function sendNewsPush(spotId: number, spotName: string, newsText: string) {
  // Haal alle user_ids op die deze spot in mijn-spots hebben
  const usersRes = await sbFetch(`user_spots?spot_id=eq.${spotId}&select=user_id`);
  const userSpots = await usersRes.json();
  if (!Array.isArray(userSpots) || userSpots.length === 0) return { sent: 0 };

  const message = newsText.length > 100 ? newsText.slice(0, 97) + "…" : newsText;

  let totalSent = 0;
  for (const { user_id } of userSpots) {
    try {
      await fetch(`${APP_URL}/api/push/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        },
        body: JSON.stringify({
          userId: user_id,
          title: `📍 Nieuws: ${spotName}`,
          message,
          url: `/spot?id=${spotId}&tab=info`,
          alertType: "news",
        }),
      });
      totalSent++;
    } catch {}
  }

  return { sent: totalSent };
}

// ── Opslaan helpers ──────────────────────────────────────────

async function saveFullScan(spotId: number, result: any) {
  const res = await sbFetch("spot_enrichment", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      spot_id: spotId,
      categories: result.categories,
      confidence: result.confidence,
      sources: result.sources,
      missing: result.missing,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Opslaan full_scan mislukt: ${res.status} — ${await res.text()}`);
}

async function saveNewsUpdate(
  spotId: number,
  existingEnrichment: any,
  newsResult: any,
  sendPush: boolean
) {
  const spotLang = getLangForSpot(existingEnrichment?._spotRegion);
  const existingCats = existingEnrichment?.categories || {};

  // Bouw nieuwe categories op: overschrijf alleen de news velden
  const newCategories = { ...existingCats };

  if (newsResult.new_news && spotLang !== "en") {
    newCategories[spotLang] = {
      ...(existingCats[spotLang] || {}),
      news: newsResult.new_news,
    };
  }
  if (newsResult.new_news_en) {
    newCategories["en"] = {
      ...(existingCats["en"] || {}),
      news: newsResult.new_news_en,
    };
  }

  const updateBody: any = {
    spot_id: spotId,
    categories: newCategories,
    confidence: existingEnrichment?.confidence,
    sources: existingEnrichment?.sources,
    missing: existingEnrichment?.missing,
    updated_at: new Date().toISOString(),
  };

  if (sendPush) {
    updateBody.last_news_push_at = new Date().toISOString();
  }

  const res = await sbFetch("spot_enrichment", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(updateBody),
  });
  if (!res.ok) throw new Error(`Opslaan news_update mislukt: ${res.status} — ${await res.text()}`);
}

// ── Main GET handler ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
  }

  try {
    // Haal max 3 pending jobs op — full_scan heeft prioriteit boven news_update
    const jobsRes = await sbFetch(
      "enrichment_jobs?status=eq.pending&order=job_type.asc,created_at.asc&limit=3&select=id,spot_id,job_type"
      // job_type asc: 'full_scan' < 'news_update' alfabetisch → full_scan eerst
    );
    const jobs = await jobsRes.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: "Geen pending jobs" });
    }

    const results: any[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      // Zet job op running
      await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "running", started_at: new Date().toISOString() }),
      });

      // Haal spot op
      const spotRes = await sbFetch(
        `spots?id=eq.${job.spot_id}&select=id,display_name,region,latitude,longitude,spot_type`
      );
      const spots = await spotRes.json();
      const spot = spots?.[0];

      if (!spot) {
        await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "error", error_msg: "Spot niet gevonden", finished_at: new Date().toISOString() }),
        });
        results.push({ job_id: job.id, spot_id: job.spot_id, status: "error", error: "Spot niet gevonden" });
        continue;
      }

      try {
        if (job.job_type === "full_scan") {
          // ── Stroom 1: volledige scan ──
          const scanResult = await runFullScan(spot);
          await saveFullScan(spot.id, scanResult);

          await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "done", result: scanResult, finished_at: new Date().toISOString() }),
          });
          results.push({ job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name, job_type: "full_scan", status: "done" });

        } else if (job.job_type === "news_update") {
          // ── Stroom 2: alleen nieuws bijwerken ──

          // Haal bestaande enrichment op
          const enrichRes = await sbFetch(
            `spot_enrichment?spot_id=eq.${spot.id}&select=categories,confidence,sources,missing,last_news_push_at`
          );
          const enrichRows = await enrichRes.json();
          const existingEnrichment = enrichRows?.[0] || null;

          // Voeg regio toe voor taaldetectie in saveNewsUpdate
          if (existingEnrichment) existingEnrichment._spotRegion = spot.region;

          const newsResult = await runNewsUpdate(spot, existingEnrichment);

          let pushSent = 0;

          if (newsResult.news_changed && (newsResult.new_news || newsResult.new_news_en)) {
            // Controleer of het al ≥14 dagen geleden is dat we een push hebben gestuurd
            const lastPush = existingEnrichment?.last_news_push_at
              ? new Date(existingEnrichment.last_news_push_at).getTime()
              : 0;
            const canPush = Date.now() - lastPush > MIN_PUSH_INTERVAL_MS;

            await saveNewsUpdate(spot.id, existingEnrichment, newsResult, canPush);

            if (canPush) {
              // Stuur push naar alle users met deze spot in mijn-spots
              const pushText = newsResult.new_news || newsResult.new_news_en || "";
              const pushResult = await sendNewsPush(spot.id, spot.display_name, pushText);
              pushSent = pushResult.sent;
            }

            await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "done",
                result: { news_changed: true, push_sent: pushSent },
                finished_at: new Date().toISOString(),
              }),
            });
            results.push({
              job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name,
              job_type: "news_update", status: "done",
              news_changed: true, push_sent: pushSent,
            });

          } else {
            // Geen nieuws gewijzigd — job afsluiten zonder opslaan
            await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "done",
                result: { news_changed: false },
                finished_at: new Date().toISOString(),
              }),
            });
            results.push({
              job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name,
              job_type: "news_update", status: "done", news_changed: false,
            });
          }
        }

      } catch (err: any) {
        await sbFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "error", error_msg: err.message, finished_at: new Date().toISOString() }),
        });
        results.push({
          job_id: job.id, spot_id: job.spot_id,
          spot_name: spot.display_name,
          job_type: job.job_type,
          status: "error", error: err.message,
        });
      }

      // 15s vertraging tussen jobs (web search rate limit)
      if (i < jobs.length - 1) await sleep(15000);
    }

    return NextResponse.json({ processed: results.length, results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
