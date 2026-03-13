"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

function SpotsTab() {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,spot_type,region,latitude,longitude&order=display_name.asc&limit=5000`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    }).then(r => r.json()).then(data => {
      setSpots(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function deleteSpot(spot: any) {
    if (!confirm(`Spot "${spot.display_name}" permanent verwijderen?\n\nDit verwijdert ook alle gekoppelde user_spots, ideal_conditions en enrichment data.`)) return;
    setDeleting(spot.id);
    try {
      // Delete in juiste volgorde vanwege foreign keys
      await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/ideal_conditions?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/user_spots?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/spot_posts?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
      ]);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=eq.${spot.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (res.ok) {
        setSpots(prev => prev.filter(s => s.id !== spot.id));
        setMsg(`✓ ${spot.display_name} verwijderd`);
        setTimeout(() => setMsg(""), 3000);
      } else {
        setMsg(`❌ Verwijderen mislukt (${res.status})`);
      }
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
    setDeleting(null);
  }

  const filtered = spots.filter(s =>
    search.length < 2 || s.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.region || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Totaal spots", value: spots.length, color: C.sky },
          { label: "Nederland", value: spots.filter(s => s.region && !s.region.includes(",")).length, color: C.green },
          { label: "Internationaal", value: spots.filter(s => s.region && s.region.includes(",")).length, color: C.navy },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 700,
          background: msg.startsWith("✓") ? "#DCFCE7" : "#FEF2F2",
          color: msg.startsWith("✓") ? "#166534" : "#DC2626",
        }}>{msg}</div>
      )}

      <input
        placeholder={`Zoek in ${spots.length} spots...`}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 13, color: C.navy, background: C.card, outline: "none", marginBottom: 12, boxSizing: "border-box" as const }}
      />

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        {filtered.length} spot{filtered.length !== 1 ? "s" : ""} {search.length >= 2 ? "gevonden" : "totaal"}
      </div>

      <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, overflow: "hidden" }}>
        {filtered.slice(0, 200).map((spot, i) => (
          <div key={spot.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${C.cardBorder}` : "none",
          }}>
            {/* Spot type badge */}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0,
              background: spot.spot_type === "Zee" ? "#DBEAFE" : spot.spot_type === "Meer" ? "#DCFCE7" : "#FEF3C7",
              color: spot.spot_type === "Zee" ? "#1D4ED8" : spot.spot_type === "Meer" ? "#166534" : "#92400E",
            }}>{spot.spot_type || "?"}</span>

            {/* Naam + regio */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {spot.display_name}
              </div>
              {spot.region && <div style={{ fontSize: 11, color: C.muted }}>{spot.region}</div>}
            </div>

            {/* Spot ID */}
            <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>#{spot.id}</span>

            {/* Verwijder knop */}
            <button
              onClick={() => deleteSpot(spot)}
              disabled={deleting === spot.id}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA",
                opacity: deleting === spot.id ? 0.5 : 1, flexShrink: 0,
              }}
            >
              {deleting === spot.id ? "⏳" : "🗑️"}
            </button>
          </div>
        ))}
        {filtered.length > 200 && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: C.muted, textAlign: "center" as const }}>
            Verfijn de zoekopdracht om meer te zien — {filtered.length - 200} spots verborgen
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: "32px 20px", fontSize: 13, color: C.muted, textAlign: "center" as const }}>
            Geen spots gevonden
          </div>
        )}
      </div>
    </div>
  );
}



export { SpotsTab };
