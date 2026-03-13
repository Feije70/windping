"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

interface Spot {
  id: number;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function SpotSelectPage() {
  const router = useRouter();
  const { token, loading: authLoading } = useUser({ redirectIfUnauthenticated: true });

  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,latitude,longitude&order=display_name.asc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSpots(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));

    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude); setLocating(false); },
      () => setLocating(false),
      { timeout: 5000 }
    );
  }, [token]);

  const spotsWithDistance = spots.map((s) => ({
    ...s,
    distance: (userLat && userLon && s.latitude && s.longitude)
      ? calcDistance(userLat, userLon, s.latitude, s.longitude)
      : undefined,
  }));

  const nearby = spotsWithDistance
    .filter((s) => s.distance !== undefined && s.distance < 100)
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  const searchLower = search.toLowerCase();
  const filtered = search
    ? spotsWithDistance.filter((s) => s.display_name.toLowerCase().includes(searchLower))
    : null;

  function selectSpot(spot: Spot) {
    localStorage.setItem("session_spot_id", String(spot.id));
    localStorage.setItem("session_spot_name", spot.display_name);
    window.location.href = "/";
  }

  function SpotRow({ spot, showDist }: { spot: Spot & { distance?: number }; showDist?: boolean }) {
    return (
      <button onClick={() => selectSpot(spot)} style={{
        width: "100%", padding: "14px 16px", textAlign: "left", background: "none",
        border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.navy,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>{spot.display_name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showDist && spot.distance != undefined && (
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{Math.round(spot.distance)} km</span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </button>
    );
  }

  if (authLoading) return null;

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
            <button onClick={() => router.push("/spot-create")} style={{
              marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: C.sky, fontWeight: 600, padding: "4px 0",
            }}>+ Nieuw</button>
          </div>
          <div style={{ position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Zoek een spot..." value={search}
              onChange={(e) => setSearch(e.target.value)} autoFocus
              style={{ width: "100%", padding: "11px 14px 11px 36px", background: C.card,
                border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14,
                color: C.navy, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ padding: "8px 16px 0" }}>
          <button onClick={() => router.push("/spot-create")} style={{
            width: "100%", padding: "13px 16px", background: C.card,
            border: `1.5px dashed ${C.sky}60`, borderRadius: 14, marginBottom: 4,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.sky }}>+ Nieuwe spot toevoegen</span>
          </button>
        </div>

        <div style={{ padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
            </div>
          ) : filtered ? (
            filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px" }}>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>Geen spots gevonden voor &ldquo;{search}&rdquo;</div>
                <button onClick={() => router.push("/spot-create")} style={{
                  padding: "11px 20px", background: C.sky, border: "none", borderRadius: 12,
                  cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff",
                }}>+ Zelf aanmaken</button>
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {filtered.map((spot, i) => (
                  <div key={spot.id} style={{ borderTop: i > 0 ? `1px solid ${C.cardBorder}` : "none" }}>
                    <SpotRow spot={spot} showDist />
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {nearby.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 8 }}>📍 IN JOUW BUURT</div>
                  <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    {nearby.map((spot, i) => (
                      <div key={spot.id} style={{ borderTop: i > 0 ? `1px solid ${C.cardBorder}` : "none" }}>
                        <SpotRow spot={spot} showDist />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {locating && !userLat && (
                <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 12 }}>Locatie bepalen...</div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 8 }}>🌍 ALLE SPOTS</div>
                <div style={{ background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  {spotsWithDistance.map((spot, i) => (
                    <div key={spot.id} style={{ borderTop: i > 0 ? `1px solid ${C.cardBorder}` : "none" }}>
                      <SpotRow spot={spot} showDist />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}