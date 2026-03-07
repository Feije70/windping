"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { cropStyle } from "@/lib/cropStyle";
import { getValidToken, isTokenExpired, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
const ratingColors: Record<number, string> = { 1: "#C97A63", 2: "#D4860B", 3: "#E8A83E", 4: "#2E8FAE", 5: "#3EAA8C" };

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "zojuist";
  if (diff < 3600) return `${Math.floor(diff / 60)}m geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`;
  if (diff < 172800) return "gisteren";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function SessionCard({ item, isNew }: { item: any; isNew: boolean }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, overflow: "hidden",
      boxShadow: C.cardShadow, marginBottom: 12,
      border: isNew ? `1.5px solid ${C.sky}30` : `1.5px solid transparent`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.sky}, ${C.skyDark || C.sky})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {item.friendName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.friendName}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(item.createdAt)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isNew && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.sky, flexShrink: 0 }} />}
          {item.status === "going" && (
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, background: `${C.green}15`, padding: "3px 8px", borderRadius: 8 }}>Gaat!</div>
          )}
          {item.rating && item.status === "completed" && (
            <div style={{ fontSize: 12, fontWeight: 700, color: ratingColors[item.rating], background: `${ratingColors[item.rating]}15`, padding: "3px 8px", borderRadius: 8 }}>
              {ratingLabels[item.rating]}
            </div>
          )}
        </div>
      </div>

      {/* Photo */}
      {item.photoUrl && (
        <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", overflow: "hidden" }}>
          <img src={item.photoUrl} alt="" style={cropStyle(item.photoCrop)} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(31,53,76,0.7) 100%)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 14, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", ...h }}>{item.spotName}</div>
            {item.forecastWind && (
              <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "4px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{item.forecastWind}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{item.forecastDir ? `${item.forecastDir} · KN` : "KN"}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spot — geen foto */}
      {!item.photoUrl && (
        <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{item.spotName}</div>
          {item.forecastWind && (
            <div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>
              {item.forecastWind}kn {item.forecastDir && <span style={{ fontSize: 11, color: C.muted }}>{item.forecastDir}</span>}
            </div>
          )}
        </div>
      )}

      {/* Gear + notes */}
      {(item.gearType || item.notes) && (
        <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {item.gearType && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.sky, background: `${C.sky}12`, borderRadius: 7, padding: "3px 9px" }}>
                {item.gearType.replace(/-/g, " ")}
              </span>
              {item.gearSize && <span style={{ fontSize: 11, color: C.sub }}>{item.gearSize}</span>}
            </div>
          )}
          {item.notes && <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{item.notes}</div>}
        </div>
      )}
    </div>
  );
}

export default function VriendenFeedPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (isTokenExpired()) { window.location.href = "/login"; return; }
    try {
      const token = await getValidToken();
      const res = await fetch("/api/friends?type=feed", {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);

    // Mark als gezien
    try {
      const token = await getValidToken();
      await fetch("/api/friends?type=mark_seen", {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      });
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy }}>Vrienden feed</div>
            {!loading && unreadCount > 0 && (
              <div style={{ fontSize: 12, color: C.sky, fontWeight: 600 }}>{unreadCount} nieuw</div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13, color: C.muted }}>Laden...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🤙</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen sessies van vrienden</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Nodig je maten uit en zie wanneer zij het water opgaan.</div>
            <Link href="/vrienden" style={{ display: "inline-block", marginTop: 14, fontSize: 13, fontWeight: 700, color: "#fff", background: C.sky, padding: "9px 18px", borderRadius: 10, textDecoration: "none" }}>
              Vrienden uitnodigen
            </Link>
          </div>
        ) : (
          sessions.map(s => <SessionCard key={s.id} item={s} isNew={s.isNew} />)
        )}
      </div>
      <NavBar />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}