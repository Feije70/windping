"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

interface Spot {
  id: number;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
}

export default function SpotSelectPage() {
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (isTokenExpired()) { window.location.href = "/login"; return; }
      try {
        const token = await getValidToken();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,latitude,longitude&order=display_name.asc`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSpots(data || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const filtered = spots.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase())
  );

  function selectSpot(spot: Spot) {
    localStorage.setItem("session_spot_id", String(spot.id));
    localStorage.setItem("session_spot_name", spot.display_name);
    router.back();
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 100px" }}>

        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.cream, padding: "16px 16px 12px", borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => router.back()} style={{
              width: 36, height: 36, borderRadius: "50%", background: C.card,
              border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <span style={{ ...h, fontSize: 20, fontWeight: 800, color: C.navy }}>Kies een spot</span>
          </div>

          {/* Zoekbalk */}
          <div style={{ position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Zoek een spot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "11px 14px 11px 36px", background: C.card,
                border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14,
                color: C.navy, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Lijst */}
        <div style={{ padding: "8px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 14 }}>
              Geen spots gevonden voor &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              {filtered.map((spot, i) => (
                <button key={spot.id} onClick={() => selectSpot(spot)} style={{
                  width: "100%", padding: "14px 16px", textAlign: "left", background: "none",
                  border: "none", borderTop: i > 0 ? `1px solid ${C.cardBorder}` : "none",
                  cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.navy,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>{spot.display_name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
