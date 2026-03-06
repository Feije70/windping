import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import DeleteSessionButton from "./DeleteSessionButton";
import ShareSessionButton from "./ShareSessionButton";

const SUPABASE_URL = "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ds6_HWMJEYxEnvrnEefeRg_q2T-ROO_";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

async function getSession(id: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${id}&status=eq.completed&select=id,spot_id,session_date,rating,gear_type,gear_size,wind_feel,forecast_wind,forecast_dir,photo_url,notes&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );
  const sessions = await res.json();
  const session = sessions?.[0];
  if (!session) return null;

  const spotRes = await fetch(
    `${SUPABASE_URL}/rest/v1/spots?id=eq.${session.spot_id}&select=display_name&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );
  const spots = await spotRes.json();
  return { ...session, spotName: spots?.[0]?.display_name || "Spot" };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return { title: "WindPing" };
  const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
  const rating = session.rating ? ratingLabels[session.rating] : "";
  const title = `${rating ? rating + " — " : ""}${session.spotName} | WindPing`;
  const description = `${session.forecast_wind ? session.forecast_wind + "kn " : ""}${session.forecast_dir || ""} · ${session.gear_type?.replace(/-/g, " ") || ""}`.trim();
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: session.photo_url ? [{ url: session.photo_url, width: 1200, height: 630 }] : [],
      siteName: "WindPing",
      type: "website",
    },
    twitter: {
      card: session.photo_url ? "summary_large_image" : "summary",
      title,
      description,
      images: session.photo_url ? [session.photo_url] : [],
    },
  };
}

const ratingColors: Record<number, string> = { 1: "#C97A63", 2: "#F59E0B", 3: "#D97706", 4: "#0EA5E9", 5: "#10B981" };
const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
const windFeelLabels: Record<string, string> = { perfect: "Perfect", underpowered: "Te weinig", overpowered: "Te veel", gusty: "Gusty" };

export default async function ShareSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);

  if (!session) {
    return (
      <div style={{ background: "#F6F1EB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F354C", marginBottom: 8 }}>Sessie niet gevonden</div>
          <Link href="/" style={{ fontSize: 14, color: "#0EA5E9", textDecoration: "none" }}>← Terug naar WindPing</Link>
        </div>
      </div>
    );
  }

  const d = new Date(session.session_date + "T12:00:00");
  const dateStr = d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isJson = (v: string | null) => !!v && (v.startsWith("{") || v.startsWith("["));

  return (
    <div style={{ background: "#F6F1EB", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 60px" }}>

        {/* Share card */}
        <div style={{ background: "#1F354C", position: "relative", overflow: "hidden" }}>
          {session.photo_url && (
            <img src={session.photo_url} alt="" style={{ width: "100%", height: 320, objectFit: "cover", display: "block", opacity: 0.85 }} />
          )}
          <div style={{
            padding: session.photo_url ? "0" : "60px 24px 32px",
            position: session.photo_url ? "absolute" : "relative",
            bottom: session.photo_url ? 0 : "auto",
            left: 0, right: 0,
            background: session.photo_url ? "linear-gradient(to top, rgba(31,53,76,0.95) 0%, transparent 100%)" : "transparent",
            paddingTop: session.photo_url ? "80px" : undefined,
            paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1.5, marginBottom: 6 }}>WINDPING</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 4 }}>{session.spotName}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: session.rating ? 12 : 0 }}>{dateStr}</div>
            {session.rating && (
              <div style={{ display: "inline-block", fontSize: 15, fontWeight: 800, color: ratingColors[session.rating], background: `${ratingColors[session.rating]}20`, padding: "4px 12px", borderRadius: 20, border: `1px solid ${ratingColors[session.rating]}40` }}>
                {ratingLabels[session.rating]}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: "20px 16px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {session.forecast_wind && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "10px 16px", boxShadow: "0 1px 4px rgba(31,53,76,0.08)" }}>
                <div style={{ fontSize: 10, color: "#8A9BB0", fontWeight: 600, marginBottom: 2 }}>WIND</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1F354C" }}>{session.forecast_wind}kn <span style={{ fontSize: 13, color: "#8A9BB0" }}>{session.forecast_dir}</span></div>
              </div>
            )}
            {session.gear_type && !isJson(session.gear_type) && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "10px 16px", boxShadow: "0 1px 4px rgba(31,53,76,0.08)" }}>
                <div style={{ fontSize: 10, color: "#8A9BB0", fontWeight: 600, marginBottom: 2 }}>GEAR</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1F354C" }}>
                  {session.gear_type.replace(/-/g, " ")}
                  {session.gear_size && !isJson(session.gear_size) && <span style={{ fontSize: 13, color: "#8A9BB0" }}> · {session.gear_size}</span>}
                </div>
              </div>
            )}
            {session.wind_feel && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "10px 16px", boxShadow: "0 1px 4px rgba(31,53,76,0.08)" }}>
                <div style={{ fontSize: 10, color: "#8A9BB0", fontWeight: 600, marginBottom: 2 }}>HOE</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1F354C" }}>{windFeelLabels[session.wind_feel] || session.wind_feel}</div>
              </div>
            )}
          </div>

          {session.notes && (
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 20, boxShadow: "0 1px 4px rgba(31,53,76,0.08)" }}>
              <div style={{ fontSize: 10, color: "#8A9BB0", fontWeight: 600, marginBottom: 6 }}>NOTITIES</div>
              <div style={{ fontSize: 14, color: "#1F354C", lineHeight: 1.6 }}>{session.notes}</div>
            </div>
          )}

          {/* Share */}
          <ShareSessionButton
            sessionId={session.id}
            spotName={session.spotName}
            wind={session.forecast_wind}
            dir={session.forecast_dir}
            rating={session.rating}
          />

          {/* Delete */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <DeleteSessionButton sessionId={session.id} />
          </div>

          {/* CTA */}
          <div style={{ background: "#1F354C", borderRadius: 16, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Ook je sessies bijhouden?</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Join WindPing 🤙</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link href="/signup" style={{ display: "inline-block", padding: "11px 22px", background: "#10B981", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                Aanmelden
              </Link>
              <Link href="/login" style={{ display: "inline-block", padding: "11px 22px", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Inloggen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}