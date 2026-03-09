import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Landtaal mapping op basis van region suffix
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
  // NL regio's hebben geen land-suffix
  const parts = region.split(", ");
  if (parts.length < 2) return "nl";
  const country = parts[parts.length - 1];
  return REGION_LANG[country] || "en";
}

const SYSTEM = `You are a researcher for a kitesurfing/windsurfing app called WindPing.
Use web_search to find current information about the given spot.
Be specific and factual — never invent information.
ALWAYS respond with valid JSON only, no markdown, no explanation.`;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
  }

  try {
    const { spot } = await req.json();
    if (!spot?.display_name) {
      return NextResponse.json({ error: "Geen spot meegegeven" }, { status: 400 });
    }

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

    // Ronde 1 — Claude zoekt op web
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
      return NextResponse.json({ error: `API fout: ${res1.status} — ${err}` }, { status: 500 });
    }

    const data1 = await res1.json();

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
        return NextResponse.json({ error: `API fout ronde 2: ${res2.status} — ${err}` }, { status: 500 });
      }

      const data2 = await res2.json();
      return parseAndReturn(data2);
    }

    return parseAndReturn(data1);

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function parseAndReturn(data: any) {
  const textBlocks = data.content?.filter((b: any) => b.type === "text") || [];
  const fullText = textBlocks.map((b: any) => b.text).join("");
  const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return NextResponse.json({
      error: "Geen JSON in response",
      raw: fullText.slice(0, 500),
      confidence: 0,
      categories: {},
      sources: [],
      missing: [],
    });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      error: "JSON parse mislukt",
      raw: fullText.slice(0, 500),
      confidence: 0,
      categories: {},
      sources: [],
      missing: [],
    });
  }
}
