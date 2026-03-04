"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { getValidToken, isTokenExpired, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

interface Session {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: string | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  wind_feel: string | null;
  notes: string | null;
  image_url: string | null;
  _spotName?: string;
}

const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
const ratingColors: Record<number, string> = { 1: "#C97A63", 2: C.amber, 3: C.gold, 4: C.sky, 5: C.green };
const windFeelLabels: Record<string, string> = { perfect: "Perfect", underpowered: "Te weinig", overpowered: "Te veel", gusty: "Gusty" };
const isJson = (v: string | null) => !!v && (v.startsWith("{") || v.startsWith("["));

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - todayD.getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function SessionCard({ s, onClick }: { s: Session; onClick: () => void }) {
  const spot = s._spotName || "Spot";
  return (
    <div onClick={onClick} style={{
      background: C.card, boxShadow: C.cardShadow, borderRadius: 16,
      overflow: "hidden", marginBottom: 12, cursor: "pointer",
      borderLeft: s.rating ? `3px solid ${ratingColors[s.rating]}` : `3px solid ${C.cardBorder}`,
    }}>
      {s.image_url && (
        <div style={{ position: "relative" }}>
          <img src={s.image_url} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 14, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{spot}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>{dateLabel(s.session_date)}</div>
            </div>
            {s.forecast_wind && (
              <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "5px 9px", textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{s.forecast_wind}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>KN</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        {!s.image_url && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{spot}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{dateLabel(s.session_date)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {s.forecast_wind && <div style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{s.forecast_wind}<span style={{ fontSize: 10 }}>kn</span></div>}
              {s.rating && <div style={{ fontSize: 12, fontWeight: 800, color: ratingColors[s.rating] }}>{ratingLabels[s.rating]}</div>}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {s.gear_type && !isJson(s.gear_type) && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.sky, background: `${C.sky}12`, borderRadius: 7, padding: "3px 9px" }}>
              {s.gear_type.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}
            </span>
          )}
          {s.gear_size && !isJson(s.gear_size) && (
            <span style={{ fontSize: 11, color: C.sub, padding: "3px 0" }}>{s.gear_size}</span>
          )}
          {s.wind_feel && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: `${C.green}12`, borderRadius: 7, padding: "3px 9px" }}>
              {windFeelLabels[s.wind_feel] || s.wind_feel}
            </span>
          )}
        </div>
        {s.notes && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {s.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionDetail({ s, onClose }: { s: Session; onClose: () => void }) {
  const spot = s._spotName || "Spot";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: C.cream, overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.cream, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style={{ ...h, fontSize: 17, fontWeight: 700, color: C.navy }}>Sessie detail</span>
      </div>
      <div style={{ padding: "0 16px 120px" }}>
        {s.image_url && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <img src={s.image_url} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
          </div>
        )}
        <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 16, padding: "16px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy }}>{spot}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{dateLabel(s.session_date)}</div>
            </div>
            {s.forecast_wind && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.sky, lineHeight: 1 }}>{s.forecast_wind}<span style={{ fontSize: 12 }}>kn</span></div>
                {s.forecast_dir && <div style={{ fontSize: 11, color: C.sub }}>{s.forecast_dir}</div>}
              </div>
            )}
          </div>
          {s.rating && (
            <div style={{ fontSize: 18, fontWeight: 800, color: ratingColors[s.rating] }}>{ratingLabels[s.rating]}</div>
          )}
        </div>

        {(s.gear_type || s.wind_feel) && (
          <div style={{ display: "grid", gridTemplateColumns: s.gear_type && s.wind_feel ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 12 }}>
            {s.gear_type && !isJson(s.gear_type) && (
              <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 4 }}>GEAR</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
                  {s.gear_type.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}
                  {s.gear_size && !isJson(s.gear_size) && <span style={{ fontSize: 13, color: C.sub }}> · {s.gear_size}</span>}
                </div>
              </div>
            )}
            {s.wind_feel && (
              <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 4 }}>WIND</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{windFeelLabels[s.wind_feel] || s.wind_feel}</div>
              </div>
            )}
          </div>
        )}

        {s.notes && (
          <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 6 }}>NOTITIES</div>
            <div style={{ fontSize: 14, color: C.navy, lineHeight: 1.6 }}>{s.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MijnSessiesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    (async () => {
      if (isTokenExpired()) { window.location.href = "/login"; return; }
      const authId = getAuthId();
      if (!authId) return;
      try {
        const token = await getValidToken();
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=id`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const users = await userRes.json();
        if (!users?.length) return;
        const userId = users[0].id;

        const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${userId}&status=eq.completed&order=id.desc&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,wind_feel,notes,image_url`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data: Session[] = await res.json() || [];

        if (data.length > 0) {
          const spotIds = [...new Set(data.map(s => s.spot_id))];
          const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=in.(${spotIds.join(",")})&select=id,display_name`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          const spotData = await spotRes.json();
          const spotMap: Record<number, string> = {};
          (spotData || []).forEach((s: any) => { spotMap[s.id] = s.display_name; });
          data.forEach(s => { s._spotName = spotMap[s.spot_id] || "Spot"; });
        }

        setSessions(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <span style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy }}>Mijn sessies</span>
          {!loading && <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>{sessions.length} sessies</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13, color: C.muted }}>Laden...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen sessies</div>
            <div style={{ fontSize: 12, color: C.muted }}>Log je eerste sessie via de feed.</div>
          </div>
        ) : (
          sessions.map(s => (
            <SessionCard key={s.id} s={s} onClick={() => setSelected(s)} />
          ))
        )}
      </div>
      {selected && <SessionDetail s={selected} onClose={() => setSelected(null)} />}
      <NavBar />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}