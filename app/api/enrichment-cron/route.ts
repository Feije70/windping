import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // Vercel Pro: 5 minuten

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";

// Landtaal mapping
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

// Default prompts als fallback
const DEFAULT_PROMPTS: Record<string, string> = {
  conditions: "Wind conditions, directions, best season, wave height, currents, water type. Null if unknown.",
  facilities: "Parking, toilets, showers, food, kite school, rental. Null if unknown.",
  hazards: "Hazards: rocks, currents, shipping, restricted zones, rules. Null if unknown.",
  tips: "Practical tips from experienced surfers, best launch spot, local knowledge. Null if unknown.",
  events: "Kite/windsurf competitions, festivals, markets, events affecting crowding. Null if unknown.",
  news: "Recent news: beach closures, new rules, construction, upcoming major events. Null if unknown.",
};

function getLangForSpot(region: string | undefined): string {
  if (!region) return "nl";
  const parts = region.split(", ");
  if (parts.length < 2) return "nl";
  const country = parts[parts.length - 1];
  return REGION_LANG[country] || "en";
}

const SYSTEM = `You are a researcher for a kitesurfing/windsurfing app called WindPing.
Use web_search to find current information about the given spot.
Be specific and factual — never invent information.
ALWAYS respond with valid JSON only, no markdown, no explanation.`;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
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

// Haal prompts op uit database, valt terug op defaults
async function loadPrompts(): Promise<Record<string, string>> {
  try {
    const res = await supabaseFetch("enrichment_prompts?select=category,prompt_text");
    if (!res.ok) return DEFAULT_PROMPTS;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_PROMPTS;
    const merged = { ...DEFAULT_PROMPTS };
    rows.forEach((r: any) => {
      if (r.category && r.prompt_text) merged[r.category] = r.prompt_text;
    });
    return merged;
  } catch {
    return DEFAULT_PROMPTS;
  }
}

async function scanSpot(spot: any, prompts: Record<string, string>): Promise<{
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
    "conditions": "${prompts.conditions}",
    "facilities": "${prompts.facilities}",
    "hazards": "${prompts.hazards}",
    "tips": "${prompts.tips}",
    "events": "${prompts.events}",
    "news": "${prompts.news}"
  }`;

  const jsonStructure = needsBothLangs
    ? `{
  "confidence": 0.0-1.0,
  "sources": ["list of URLs or site names used"],
  "categories": {
    "${spotLang}": ${categoryFields},
    "en": ${categoryFields}
  },
  "missing": ["categories where nothing was found"]
}`
    : `{
  "confidence": 0.0-1.0,
  "sources": ["list of URLs or site names used"],
  "categories": {
    "en": ${categoryFields}
  },
  "missing": ["categories where nothing was found"]
}`;

  const prompt = `Find information about the kitesurfing/windsurfing spot: "${spot.display_name}"${locationHint}.

Use web_search to find current info. Search for example:
- "${spot.display_name} kitesurf" or "${spot.display_name} windsurf"
- "${spot.display_name} beach facilities"
- "${spot.display_name} news ${new Date().getFullYear()}"

${langInstruction}

Respond with JSON in exactly this structure:
${jsonStructure}`;

  const tools = [{ type: "web_search_20250305", name: "web_search" }];
  let messages: any[] = [{ role: "user", content: prompt }];

  // Ronde 1
  const res1 = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: needsBothLangs ? 8000 : 5000,
      system: SYSTEM,
      tools,
      messages,
    }),
  });

  if (!res1.ok) {
    const err = await res1.text();
    throw new Error(`Anthropic API fout: ${res1.status} — ${err}`);
  }

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
        max_tokens: needsBothLangs ? 4000 : 2000,
        system: SYSTEM,
        tools,
        messages,
      }),
    });

    if (!res2.ok) {
      const err = await res2.text();
      throw new Error(`Anthropic API fout ronde 2: ${res2.status} — ${err}`);
    }

    finalData = await res2.json();
  }

  const textBlocks = finalData.content?.filter((b: any) => b.type === "text") || [];
  const fullText = textBlocks.map((b: any) => b.text).join("");
  const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`Geen JSON in response. Raw: ${fullText.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]);
}

async function saveEnrichment(spotId: number, result: any) {
  const upsertRes = await supabaseFetch("spot_enrichment", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      spot_id: spotId,
      categories: result.categories,
      confidence: result.confidence,
      sources: result.sources,
      missing: result.missing,
      updated_at: new Date().toISOString(),
      scanned_at: new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    throw new Error(`Supabase upsert mislukt: ${upsertRes.status} — ${err}`);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (key !== CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
  }

  try {
    // Laad prompts uit database (met fallback op defaults)
    const prompts = await loadPrompts();

    // Haal max 3 pending jobs op
    const jobsRes = await supabaseFetch(
      "enrichment_jobs?status=eq.pending&order=created_at.asc&limit=3&select=id,spot_id"
    );
    const jobs = await jobsRes.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: "Geen pending jobs" });
    }

    const results: any[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "running",
          started_at: new Date().toISOString(),
        }),
      });

      const spotRes = await supabaseFetch(
        `spots?id=eq.${job.spot_id}&select=id,display_name,region,latitude,longitude,spot_type`
      );
      const spots = await spotRes.json();
      const spot = spots?.[0];

      if (!spot) {
        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "error",
            error_msg: "Spot niet gevonden",
            finished_at: new Date().toISOString(),
          }),
        });
        results.push({ job_id: job.id, spot_id: job.spot_id, status: "error", error: "Spot niet gevonden" });
        continue;
      }

      try {
        const scanResult = await scanSpot(spot, prompts);
        await saveEnrichment(spot.id, scanResult);

        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "done",
            result: scanResult,
            finished_at: new Date().toISOString(),
          }),
        });

        results.push({ job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name, status: "done" });
      } catch (err: any) {
        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "error",
            error_msg: err.message,
            finished_at: new Date().toISOString(),
          }),
        });
        results.push({ job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name, status: "error", error: err.message });
      }

      if (i < jobs.length - 1) {
        await sleep(15000);
      }
    }

    return NextResponse.json({ processed: results.length, results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}