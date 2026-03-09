import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
  }

  try {
    const { spot } = await req.json();
    if (!spot?.display_name) {
      return NextResponse.json({ error: "Geen spot meegegeven" }, { status: 400 });
    }

    const spotName = spot.display_name;
    const spotType = spot.spot_type || "water sport spot";
    const lat = spot.latitude ? `${spot.latitude.toFixed(4)}` : "";
    const lng = spot.longitude ? `${spot.longitude.toFixed(4)}` : "";
    const locationHint = lat && lng ? ` (coördinaten: ${lat}, ${lng})` : "";

    const prompt = `Je bent een researcher voor een kitesurf/windsurf app. Zoek uitgebreide informatie over de volgende spot:

Naam: ${spotName}
Type: ${spotType}${locationHint}

Zoek op het web naar relevante informatie en vul de volgende categorieën in. Schrijf in het Nederlands. Wees specifiek en feitelijk — verzin niks, baseer alles op wat je vindt.

Geef je antwoord als JSON met deze structuur:
{
  "confidence": 0.0-1.0,
  "sources": ["lijst van gebruikte bronnen/websites"],
  "categories": {
    "history": "Geschiedenis en oorsprong van de spot. Waarom heet het zo? Hoe lang wordt er gesurft?",
    "conditions": "Typische windcondities, windrichtingen, beste seizoen, golfhoogte, stromingen, watertype",
    "facilities": "Parkeren, toiletten, douches, horeca, kiteschool, materiaalverhuur, strand- of kadeomstandigheden",
    "hazards": "Gevaren: rotsen, stromingen, scheepvaart, kitezones, verboden gebieden, regels",
    "tips": "Praktische tips van ervaren surfers. Beste plek om te starten, lokale kennis",
    "events": "Bekende kitesurf/windsurf wedstrijden of events die hier plaatsvinden. Maar ook andere events op of nabij de spot: festivals, sportevenementen, beachvolleybal, marathons, airshows, markten — alles wat invloed kan hebben op drukte of parkeren.",
    "news": "Recent nieuws over de spot (laatste 1-2 jaar). Denk aan strandafsluitingen, natuurgebied wijzigingen, bouwprojecten, nieuwe regels, maar ook grote events die eraan komen."
  },
  "missing": ["categorieën waarvoor geen info gevonden is"]
}

Zet null voor categorieën waarvoor je werkelijk niks kunt vinden. Geef confidence 0.9 als je veel betrouwbare bronnen hebt, 0.5 bij weinig info, 0.2 als je nauwelijks iets vindt.

Antwoord ALLEEN met de JSON, geen uitleg of markdown.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `API fout: ${response.status} — ${err}` }, { status: 500 });
    }

    const data = await response.json();

    // Haal tekst uit response (kan meerdere content blocks zijn na tool use)
    const textBlocks = data.content?.filter((b: any) => b.type === "text") || [];
    const fullText = textBlocks.map((b: any) => b.text).join("");

    // Parse JSON uit de response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
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

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
