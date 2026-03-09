import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jdgqbxpgkfkxzxzqzxzq.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

async function sbAdmin(path: string, method = "GET", body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`sb_${res.status}`);
  if (method === "GET" || (method === "POST" && res.headers.get("content-type")?.includes("json"))) {
    return res.json();
  }
  return null;
}

async function moderateContent(content: string, type: string): Promise<"ok" | "flagged" | "blocked"> {
  if (!ANTHROPIC_API_KEY) return "ok"; // geen key → altijd ok (dev mode)

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
        max_tokens: 50,
        messages: [{
          role: "user",
          content: `Je bent een moderator voor een kitesurf/windsurf community app. Beoordeel deze post op het prikbord van een spot.

Type: ${type}
Inhoud: "${content}"

Regels:
- BLOCKED: pornografische inhoud, expliciete seksuele content, grove beledigingen, haatzaaien, spam/reclame
- FLAGGED: lichte scheldwoorden, mogelijk aanstootgevende inhoud, onduidelijke intentie
- OK: normale community berichten, tips, rapporten, vragen, planningen

Antwoord met ALLEEN één woord: OK, FLAGGED, of BLOCKED`,
        }],
      }),
    });

    if (!res.ok) return "ok"; // bij API fout → doorlaten
    const data = await res.json();
    const verdict = data.content?.[0]?.text?.trim().toUpperCase();

    if (verdict === "BLOCKED") return "blocked";
    if (verdict === "FLAGGED") return "flagged";
    return "ok";
  } catch {
    return "ok"; // bij fout → doorlaten
  }
}

// POST /api/prikbord — nieuwe post indienen + modereren
export async function POST(req: NextRequest) {
  try {
    const { spot_id, user_id, author_name, type, content } = await req.json();

    if (!spot_id || !user_id || !content?.trim()) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // AI moderatie
    const status = await moderateContent(content.trim(), type);

    // Post opslaan
    const [post] = await sbAdmin("spot_posts", "POST", {
      spot_id, user_id, author_name, type,
      content: content.trim(),
      status,
    });

    if (status === "blocked") {
      return NextResponse.json({ blocked: true, message: "Je bericht is niet geplaatst vanwege ongepaste inhoud." }, { status: 422 });
    }

    return NextResponse.json({ post, flagged: status === "flagged" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/prikbord/report — post melden
export async function PUT(req: NextRequest) {
  try {
    const { post_id, user_id, reason } = await req.json();

    if (!post_id || !user_id) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Sla melding op
    await sbAdmin("post_reports", "POST", { post_id, user_id, reason: reason || null });

    // Zet post op flagged als die nog ok was
    await fetch(`${SUPABASE_URL}/rest/v1/spot_posts?id=eq.${post_id}&status=eq.ok`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "flagged" }),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Duplicate report (al gemeld door deze user) → gewoon ok teruggeven
    if (e.message?.includes("409") || e.message?.includes("unique")) {
      return NextResponse.json({ ok: true, already_reported: true });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
