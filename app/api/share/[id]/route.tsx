// app/api/share/[id]/route.tsx
import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export const runtime = "edge";

const RATING_EMOJI: Record<number, string> = { 1: "💩", 2: "😐", 3: "👍", 4: "🤙", 5: "🔥" };
const RATING_LABEL: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };

async function getSession(id: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${id}&select=id,rating,forecast_wind,forecast_dir,gear_type,gear_size,session_date,spots(display_name)`,
    { headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
  );
  const data = await res.json();
  return data?.[0] || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);

  const spotName    = session?.spots?.display_name || "WindPing";
  const rating      = session?.rating || null;
  const wind        = session?.forecast_wind || null;
  const dir         = session?.forecast_dir || "";
  const emoji       = rating ? RATING_EMOJI[rating] : "🌊";
  const ratingLabel = rating ? RATING_LABEL[rating] : "";

  let gearStr = "";
  try {
    const types = JSON.parse(session?.gear_type || "[]") as string[];
    const sizes = JSON.parse(session?.gear_size  || "{}") as Record<string, string>;
    const labels: Record<string, string> = { kite: "Kite", windsurf: "Zeil", wing: "Wing" };
    gearStr = types.map(t => {
      const s = sizes[t];
      return s ? `${labels[t] || t} ${s}m²` : labels[t] || t;
    }).join("  ·  ");
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #0B1E35 0%, #1A3A5C 100%)",
          fontFamily: "system-ui, sans-serif", position: "relative",
        }}
      >
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "rgba(74,189,232,0.06)", top: -200, right: -200, display: "flex" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(74,189,232,0.04)", bottom: -150, left: -100, display: "flex" }} />

        <div style={{ position: "absolute", top: 40, left: 48, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>WindPing</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ABDE8", display: "flex" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 96 }}>{emoji}</span>
          {ratingLabel && <span style={{ fontSize: 52, fontWeight: 800, color: "#ffffff" }}>{ratingLabel}</span>}
          <span style={{ fontSize: 38, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{spotName}</span>
          {wind && <span style={{ fontSize: 28, fontWeight: 700, color: "#4ABDE8" }}>{wind}kn {dir}</span>}
          {gearStr && <span style={{ fontSize: 22, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{gearStr}</span>}
        </div>

        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, padding: "18px 48px",
          background: "rgba(255,255,255,0.07)", borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Volg jouw windalerts</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#4ABDE8" }}>windping.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}