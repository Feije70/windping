import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

const SYSTEM = `You are a researcher for a kitesurfing/windsurfing app called WindPing.
Use web_search to find current information about the given spot.
Be specific and factual — never invent information.
ALWAYS respond with valid JSON only, no markdown, no explanation.`;

// Haal prompts op uit database, valt terug op defaults
async function loadPrompts(): Promise<Record<string, string>> {
  const defaults: Record<string, string> = {
    conditions: "Wind conditions, directions, best season, wave height, currents, water type. Null if unknown.",
    facilities: "Parking, toilets, showers, food, kite school, rental. Null if unknown.",
    hazards: "Hazards: rocks, currents, shipping, restricted zones, rules. Null if unknown.",
    tips: "Practical tips from experienced surfers, best launch spot, local knowledge. Null if unknown.",
    events: "Kite/windsurf competitions, festivals, markets, events affecting crowding. Null if unknown.",
    news: "Recent news: beach closures, new rules, construction, upcoming major events. Null if unknown.",
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enrichment_prompts?select=category,prompt_text`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!res.ok) return defaults;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return defaults;
    const merged = { ...defaults };
    rows.forEach((r: any) => { if (r.category && r.prompt_text) merged[r.category] = r.prompt_text; });
    return merged;
  } catch {
    return defaults;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { spot } = await req.json();
    if (!spot) {
      return NextResponse.json({ error: "Geen spot meegegeven" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const prompts = await loadPrompts();

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
      return NextResponse.json({ error: `Anthropic fout: ${res1.status} — ${err}` }, { status: 500 });
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
        return NextResponse.json({ error: `Anthropic fout ronde 2: ${res2.status} — ${err}` }, { status: 500 });
      }

      finalData = await res2.json();
    }

    const textBlocks = finalData.content?.filter((b: any) => b.type === "text") || [];
    const fullText = textBlocks.map((b: any) => b.text).join("");
    const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: `Geen JSON in response. Raw: ${fullText.slice(0, 200)}` }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Sla op in spot_enrichment
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        spot_id: spot.id,
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
      return NextResponse.json({ error: `Opslaan mislukt: ${err}` }, { status: 500 });
    }

    return NextResponse.json(result);

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}