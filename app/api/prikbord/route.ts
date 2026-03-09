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

const BLOCKED_WORDS = [
  // Nederlands
  "kut", "lul", "pik", "neuken", "neuk", "fikken", "flikken", "hoer", "slet", "teef",
  "klootzak", "eikel", "godverdomme", "godver", "verdomme", "kanker", "kankerlijer",
  "tyfus", "tering", "pest", "cholera", "aids", "mongool", "idioot", "debiel", "sukkel",
  "stomkop", "donder op", "rot op", "lazer op", "opzouten", "likken", "pijpen", "tieten",
  "kont", "reet", "kak", "stront", "schijt", "poepen",
  // Engels
  "fuck", "shit", "ass", "bitch", "cunt", "cock", "dick", "pussy", "bastard", "whore",
  "nigger", "faggot", "retard",
];

function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some(word => {
    // Hele woord match (niet als onderdeel van een ander woord)
    const regex = new RegExp(`(^|\\s|[^a-z])${word}($|\\s|[^a-z])`, "i");
    return regex.test(lower);
  });
}

async function moderateContent(content: string, type: string): Promise<"ok" | "flagged" | "blocked"> {
  if (!ANTHROPIC_API_KEY) return "ok"; // geen key → altijd ok (dev mode)

  // Harde woordenlijst filter — altijd geblokkeerd ongeacht AI
  if (containsBlockedWord(content)) return "blocked";

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
          content: `Je bent een strenge moderator voor een kitesurf/windsurf community app voor alle leeftijden. Beoordeel deze prikbord post.

Type: ${type}
Inhoud: "${content}"

BLOCKED (niet plaatsen):
- Scheldwoorden, vloeken, grove taal (ook licht: kut, godverdomme, klootzak etc.)
- Seksuele of pornografische inhoud
- Beledigingen of haatzaaien
- Spam of reclame
- Zinloze of testberichten zonder betekenis

FLAGGED (twijfelgeval, admin bekijkt):
- Twijfelachtige intentie
- Mogelijk beledigend voor sommigen

OK (gewoon plaatsen):
- Windrapport, spotcondities, weersomstandigheden
- Tips over de spot, gevaren, parkeren
- Planningen ("wie gaat er mee?")
- Vragen over materiaal of de spot
- Positieve community berichten

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

    // Haal post op voor email context
    const posts = await sbAdmin(`spot_posts?id=eq.${post_id}&select=content,author_name,type,spot_id`);
    const post = posts?.[0];

    // Email notificatie naar admin
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && post) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "WindPing <noreply@windping.com>",
          to: "feije@windping.com",
          subject: "🚩 Prikbord melding",
          html: `<p>Een bericht is gemeld op het prikbord.</p>
                 <p><strong>Type:</strong> ${post.type}<br>
                 <strong>Door:</strong> ${post.author_name}<br>
                 <strong>Spot ID:</strong> ${post.spot_id}<br>
                 <strong>Inhoud:</strong> "${post.content}"</p>
                 <p><a href="https://www.windping.com/admin">Bekijk in admin → 🚩 Moderatie</a></p>`,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Duplicate report (al gemeld door deze user) → gewoon ok teruggeven
    if (e.message?.includes("409") || e.message?.includes("unique")) {
      return NextResponse.json({ ok: true, already_reported: true });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/prikbord?id=X&user_id=Y — eigen post verwijderen
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("user_id");

    if (!id || !userId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    // Alleen eigen post verwijderen
    await fetch(`${SUPABASE_URL}/rest/v1/spot_posts?id=eq.${id}&user_id=eq.${userId}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
