import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const SYSTEM = `Je bent een researcher voor een kitesurf/windsurf app genaamd WindPing. 
Gebruik web_search om actuele informatie te vinden over de gegeven spot.
Schrijf altijd in het Nederlands. Wees specifiek en feitelijk — verzin niets.
Antwoord ALTIJD met alleen geldige JSON, geen markdown omheen, geen uitleg.`;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
  }

  try {
    const { spot } = await req.json();
    if (!spot?.display_name) {
      return NextResponse.json({ error: "Geen spot meegegeven" }, { status: 400 });
    }

    const locationHint = spot.region
      ? ` in ${spot.region}`
      : spot.latitude && spot.longitude
        ? ` (coördinaten: ${spot.latitude.toFixed(3)}, ${spot.longitude.toFixed(3)})`
        : "";

    const prompt = `Zoek informatie over kitesurf/windsurf spot: "${spot.display_name}"${locationHint}.

Gebruik web_search om actuele info te vinden. Zoek bijvoorbeeld op:
- "${spot.display_name} kitesurf" of "${spot.display_name} windsurf"
- "${spot.display_name} strand faciliteiten"
- "${spot.display_name} nieuws ${new Date().getFullYear()}"

Geef je antwoord als JSON met exact deze structuur:
{
  "confidence": 0.0-1.0,
  "sources": ["lijst van gebruikte URLs of sitenamen"],
  "categories": {
    "conditions": "Windcondities, windrichtingen, beste seizoen, golfhoogte, stromingen, watertype. Null als onbekend.",
    "facilities": "Parkeren, toiletten, douches, horeca, kiteschool, materiaalverhuur. Null als onbekend.",
    "hazards": "Gevaren: rotsen, stromingen, scheepvaart, verboden zones, regels. Null als onbekend.",
    "tips": "Praktische tips van ervaren surfers, beste startplek, lokale kennis. Null als onbekend.",
    "events": "Kitesurf/windsurf wedstrijden, maar ook festivals, markten, sportevenementen die de drukte beïnvloeden. Null als onbekend.",
    "news": "Recent nieuws: strandafsluitingen, nieuwe regels, bouwprojecten, komende grote events. Null als onbekend."
  },
  "missing": ["categorieën waarvoor echt niets gevonden is"]
}`;

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
        max_tokens: 5000,
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

    // Als Claude tool_use doet, verwerk de zoekresultaten en vraag om JSON output
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
            content: `Zoekresultaten voor "${b.input?.query || ""}" zijn verwerkt.`,
          })),
        },
      ];

      // Ronde 2 — Claude verwerkt zoekresultaten tot JSON
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
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

  // Strip markdown code fences if present
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