import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_KEY = "WindPing-cron-key-2026";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "feijekooistra@hotmail.com";

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

async function scoreNews(newsText: string, spotName: string): Promise<number> {
  if (!newsText || newsText.trim().length < 20) return 0;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{
          role: "user",
          content: `Rate news relevance for kitesurfers/windsurfers at "${spotName}" (0-10). 10=critical, 8-9=very relevant, 6-7=relevant, 4-5=somewhat, 1-3=not very, 0=irrelevant. News: "${newsText.substring(0, 400)}". Reply ONLY with a single integer 0-10.`,
        }],
      }),
    });
    if (!res.ok) return 5;
    const data = await res.json();
    const score = parseInt((data.content?.[0]?.text || "5").replace(/\D/g, ""), 10);
    return isNaN(score) ? 5 : Math.min(10, Math.max(0, score));
  } catch {
    return 5;
  }
}

async function saveEnrichment(spotId: number, result: any, jobType: string = "full_scan", spotName: string = "") {
  const now = new Date().toISOString();
  const payload: any = {
    spot_id: spotId,
    categories: result.categories,
    confidence: result.confidence,
    sources: result.sources,
    missing: result.missing,
    updated_at: now,
    scanned_at: now,
  };

  if (jobType === "news_update") {
    const cats = result.categories || {};
    const layer = cats.nl || cats.en || cats;
    const newsText = layer?.news || "";
    payload.news_score = await scoreNews(newsText, spotName);
    payload.news_push_blocked = false;
  }

  const upsertRes = await supabaseFetch("spot_enrichment", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(payload),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    throw new Error(`Supabase upsert mislukt: ${upsertRes.status} — ${err}`);
  }
}

async function sendNewsOverviewEmail() {
  if (!RESEND_API_KEY) return;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichRes = await supabaseFetch(
      `spot_enrichment?updated_at=gte.${today.toISOString()}&news_score=gte.1&select=spot_id,news_score,news_push_blocked,categories`
    );
    const enrichData = await enrichRes.json();
    if (!Array.isArray(enrichData) || enrichData.length === 0) return;

    const spotIds = enrichData.map((e: any) => e.spot_id);
    const spotsRes = await supabaseFetch(`spots?id=in.(${spotIds.join(",")})&select=id,display_name,country`);
    const spotsData = await spotsRes.json();
    const spotMap: Record<number, any> = {};
    if (Array.isArray(spotsData)) spotsData.forEach((s: any) => { spotMap[s.id] = s; });

    const pushCount = enrichData.filter((e: any) => (e.news_score || 0) >= 7 && !e.news_push_blocked).length;

    const rows = enrichData
      .sort((a: any, b: any) => (b.news_score || 0) - (a.news_score || 0))
      .map((e: any) => {
        const spot = spotMap[e.spot_id];
        const spotName = spot?.display_name || `Spot #${e.spot_id}`;
        const isNL = spot?.country === "NL";
        const cats = e.categories || {};
        const layer = isNL ? (cats.nl || cats.en || cats) : (cats.en || cats);
        const newsText = layer?.news || "—";
        const score = e.news_score || 0;
        const willPush = score >= 7 && !e.news_push_blocked;
        const scoreColor = score >= 7 ? "#166534" : score >= 5 ? "#92400E" : "#6B7280";
        const scoreBg = score >= 7 ? "#DCFCE7" : score >= 5 ? "#FEF3C7" : "#F3F4F6";
        return `<tr style="border-bottom:1px solid #E5E7EB"><td style="padding:12px 8px;font-weight:700;color:#1B3A5C">${spotName}</td><td style="padding:12px 8px;text-align:center"><span style="background:${scoreBg};color:${scoreColor};padding:3px 8px;border-radius:6px;font-weight:700;font-size:13px">${score}/10</span></td><td style="padding:12px 8px;text-align:center;font-size:13px">${willPush ? "✅ Push gepland" : score >= 7 ? "🔕 Geblokkeerd" : "— Geen push"}</td><td style="padding:12px 8px;font-size:13px;color:#374151">${newsText}</td></tr>`;
      }).join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "WindPing <alerts@windping.com>",
        to: ADMIN_EMAIL,
        subject: `📰 WindPing Nieuws — ${pushCount} push${pushCount !== 1 ? "es" : ""} gepland voor vandaag`,
        html: `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px"><div style="background:#1B3A5C;color:white;padding:20px 24px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:22px">📰 WindPing Nieuws Overzicht</h1></div><div style="background:#F0FDF4;padding:14px 24px;border-left:4px solid #22C55E"><strong style="color:#166534">${enrichData.length} spots gescand</strong> — <strong style="color:#1D4ED8">${pushCount} krijgen push om 18:00</strong></div><table style="width:100%;border-collapse:collapse;background:white"><thead><tr style="background:#F9FAFB"><th style="padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">SPOT</th><th style="padding:10px 8px;text-align:center;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">SCORE</th><th style="padding:10px 8px;text-align:center;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">PUSH</th><th style="padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB">NIEUWS</th></tr></thead><tbody>${rows}</tbody></table><div style="padding:16px 24px;background:#F9FAFB;border-radius:0 0 12px 12px;font-size:13px;color:#6B7280">Blokkeren via <a href="https://www.windping.com/admin" style="color:#2B9ED4">windping.com/admin</a></div></div>`,
      }),
    });
  } catch (e) {
    console.error("Nieuws email fout:", e);
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
    const prompts = await loadPrompts();

    const jobsRes = await supabaseFetch(
      "enrichment_jobs?status=eq.pending&order=created_at.asc&limit=3&select=id,spot_id,job_type"
    );
    const jobs = await jobsRes.json();

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: "Geen pending jobs" });
    }

    const results: any[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const jobType = job.job_type || "full_scan";

      await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "running", started_at: new Date().toISOString() }),
      });

      const spotRes = await supabaseFetch(
        `spots?id=eq.${job.spot_id}&select=id,display_name,region,latitude,longitude,spot_type,country`
      );
      const spots = await spotRes.json();
      const spot = spots?.[0];

      if (!spot) {
        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "error", error_msg: "Spot niet gevonden", finished_at: new Date().toISOString() }),
        });
        results.push({ job_id: job.id, spot_id: job.spot_id, status: "error", error: "Spot niet gevonden" });
        continue;
      }

      try {
        const scanResult = await scanSpot(spot, prompts);
        await saveEnrichment(spot.id, scanResult, jobType, spot.display_name);

        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "done", result: scanResult, finished_at: new Date().toISOString() }),
        });

        results.push({ job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name, job_type: jobType, status: "done" });
      } catch (err: any) {
        await supabaseFetch(`enrichment_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "error", error_msg: err.message, finished_at: new Date().toISOString() }),
        });
        results.push({ job_id: job.id, spot_id: job.spot_id, spot_name: spot.display_name, job_type: jobType, status: "error", error: err.message });
      }

      if (i < jobs.length - 1) {
        await sleep(15000);
      }
    }

    // Stuur overzicht-email als alle news_update jobs klaar zijn
    const hadNewsJobs = results.some((r: any) => r.job_type === "news_update");
    if (hadNewsJobs) {
      const pendingRes = await supabaseFetch(
        "enrichment_jobs?status=in.(pending,running)&job_type=eq.news_update&select=id&limit=1"
      );
      const pendingJobs = await pendingRes.json();
      if (!Array.isArray(pendingJobs) || pendingJobs.length === 0) {
        await sendNewsOverviewEmail();
      }
    }

    return NextResponse.json({ processed: results.length, results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}