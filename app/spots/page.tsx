"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

const SpotsMap = dynamic(() => import("@/components/SpotsMap"), { ssr: false, loading: () => (
  <div style={{ width: "100%", height: 400, borderRadius: 16, background: C.card, border: `1px solid ${C.cardBorder}`, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
  </div>
)});

interface Spot {
  id: number;
  display_name: string;
  latitude: number;
  longitude: number;
  spot_type: string | null;
  level: string | null;
  min_wind: number | null;
  max_wind: number | null;
  good_directions: string[] | null;
  tips: string | null;
}

const typeColors: Record<string, string> = { Zee: "#2E8FAE", Meer: "#3EAA8C", Rivier: "#E8A83E" };

function SpotCard({ spot, fromOnboarding }: { spot: Spot; fromOnboarding?: boolean }) {
  const dirs = spot.good_directions?.join(", ") || "—";
  const typeColor = typeColors[spot.spot_type || ""] || C.sky;
  const href = fromOnboarding ? `/spot?id=${spot.id}&tab=voorkeuren` : `/spot?id=${spot.id}`;

  return (
    <a href={href} style={{
      display: "block", background: C.card, borderRadius: 14, boxShadow: C.cardShadow,
      padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", textDecoration: "none", color: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{spot.display_name}</span>
        {spot.spot_type && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${typeColor}20`, color: typeColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {spot.spot_type}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
        {spot.level && <span>Level: {spot.level}</span>}
        <span>Wind: {spot.min_wind || "?"}-{spot.max_wind || "?"} kn</span>
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Direction: {dirs}</div>
    </a>
  );
}

function SpotsContent() {
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";
  const { token, loading: authLoading } = useUser({ redirectIfUnauthenticated: true });

  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/rest/v1/spots?active=eq.true&is_private=eq.false&select=id,display_name,latitude,longitude,spot_type,level,min_wind,max_wind,good_directions,tips&order=display_name`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSpots(data || []))
      .catch((e) => console.warn("Spots load error:", e))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = spots.filter((s) => {
    if (!search && !visibleIds.has(s.id) && visibleIds.size > 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.display_name.toLowerCase().includes(q)
      || (s.spot_type || "").toLowerCase().includes(q)
      || (s.level || "").toLowerCase().includes(q)
      || (s.good_directions || []).join(" ").toLowerCase().includes(q);
  });

  if (authLoading) return null;

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>
        <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 2, color: C.navy, margin: "0 0 16px" }}>Spots</h1>

        <SpotsMap spots={spots} onBoundsChange={setVisibleIds} />

        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search spots..."
          style={{
            width: "100%", padding: "12px 16px", background: C.card, border: `1.5px solid ${C.cardBorder}`,
            borderRadius: 12, fontSize: 14, color: C.navy, outline: "none", marginBottom: 8, boxSizing: "border-box",
          }}
        />

        <div style={{ fontSize: 12, color: C.sub, padding: "4px 0 12px 2px" }}>
          {filtered.length} of {spots.length} spots{search ? ` (search: "${search}")` : ""}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          </div>
        )}

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.map((spot) => (
              <SpotCard key={spot.id} spot={spot} fromOnboarding={fromOnboarding} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 20px", color: C.muted, fontSize: 14 }}>
            No spots found. Zoom out or change your search.
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SpotsPage() {
  return (
    <Suspense fallback={<div />}>
      <SpotsContent />
    </Suspense>
  );
}
