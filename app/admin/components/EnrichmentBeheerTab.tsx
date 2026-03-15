"use client";
import { useEffect, useState } from "react";
import { C, enrichmentLabels } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { EnrichmentIcons } from "./EnrichmentIcons";

function stripCite(text: string): string {
  if (!text) return text;
  return text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, '$1').trim();
}

interface EnrichmentRow {
  spot_id: number;
  confidence: number | null;
  sources: string[] | null;
  categories: Record<string, Record<string, string | null> | null> | null;
  scanned_at: string | null;
  updated_at: string;
  news_score: number | null;
  news_push_blocked: boolean;
  missing?: string[] | null;
}

interface SpotRow {
  id: number;
  display_name: string;
  region: string | null;
  spot_type: string | null;
}

function EnrichmentBeheerTab() {
  const [saved, setSaved] = useState<EnrichmentRow[]>([]);
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editCats, setEditCats] = useState<Record<string, string>>({});
  const [editLang, setEditLang] = useState<string>("nl");
  const [editAllLangs, setEditAllLangs] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const labels: Record<string, string> = {
    conditions: "Windcondities & karakter",
    facilities: "Faciliteiten",
    hazards: "Gevaren",
    tips: "Tips",
    events: "Events & wedstrijden",
    news: "Actueel nieuws",
  };

  useEffect(() => {
    async function load() {
      const [enrichRes, spotsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?select=spot_id,confidence,sources,categories,scanned_at,updated_at,news_score,news_push_blocked&order=updated_at.desc`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,region,spot_type&limit=5000`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
      ]);
      setSaved(Array.isArray(enrichRes) ? enrichRes : []);
      setSpots(Array.isArray(spotsRes) ? spotsRes : []);
      setLoading(false);
    }
    load();
  }, []);

  function getSpot(spot_id: number) {
    return spots.find(s => s.id === spot_id);
  }

  function startEdit(row: EnrichmentRow) {
    setEditId(row.spot_id);
    const raw = row.categories || {};
    const isMultiLang = raw.nl || raw.en;
    // Bewaar alle taallagen
    const allLangs: Record<string, Record<string, string>> = {};
    if (isMultiLang) {
      ["nl","en","de","fr","es","pt","it"].forEach(lang => {
        if (raw[lang] && typeof raw[lang] === "object") {
          const cats: Record<string, string> = {};
          Object.entries(raw[lang]).forEach(([k, v]) => { if (typeof v === "string") cats[k] = stripCite(v); });
          if (Object.keys(cats).length > 0) allLangs[lang] = cats;
        }
      });
    } else {
      const cats: Record<string, string> = {};
      Object.entries(raw).forEach(([k, v]) => { if (typeof v === "string") cats[k] = stripCite(v); });
      allLangs["nl"] = cats;
    }
    setEditAllLangs(allLangs);
    const defaultLang = allLangs["nl"] ? "nl" : Object.keys(allLangs)[0] || "nl";
    setEditLang(defaultLang);
    setEditCats(allLangs[defaultLang] || {});
    setMsg("");
  }

  async function toggleBlock(spot_id: number, currentBlocked: boolean) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot_id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ news_push_blocked: !currentBlocked }),
      });
      setSaved(prev => prev.map(r => r.spot_id === spot_id ? { ...r, news_push_blocked: !currentBlocked } : r));
      setMsg(currentBlocked ? "✓ Push-blokkering opgeheven" : "✓ Nieuws-push geblokkeerd voor deze spot");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("❌ Opslaan mislukt"); }
  }

  async function saveEdit(spot_id: number, row: EnrichmentRow) {
    setSaving(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        spot_id,
        confidence: row.confidence,
        sources: row.sources,
        categories: Object.keys(editAllLangs).length > 1
              ? { ...editAllLangs, [editLang]: editCats }
              : editCats,
        missing: row.missing,
        scanned_at: row.scanned_at,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      setSaved(prev => prev.map(r => r.spot_id === spot_id ? { ...r, categories: Object.keys(editAllLangs).length > 1 ? { ...editAllLangs, [editLang]: editCats } as EnrichmentRow["categories"] : null, updated_at: new Date().toISOString() } : r));
      setMsg("✓ Opgeslagen");
      setEditId(null);
    } else {
      setMsg("❌ Opslaan mislukt");
    }
    setSaving(false);
  }

  async function deleteRow(spot_id: number, spotName: string) {
    if (!confirm(`Enrichment data voor ${spotName} verwijderen?`)) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot_id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (res.ok) {
      setSaved(prev => prev.filter(r => r.spot_id !== spot_id));
      if (editId === spot_id) setEditId(null);
      setMsg("✓ Verwijderd");
    } else {
      setMsg("❌ Verwijderen mislukt");
    }
  }

  const filtered = saved.filter(r => {
    const spot = getSpot(r.spot_id);
    if (!spot) return true;
    return spot.display_name.toLowerCase().includes(searchQ.toLowerCase());
  });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Opgeslagen spots", value: saved.length, color: C.sky },
          { label: "Hoog betrouwbaar", value: saved.filter(r => (r.confidence || 0) > 0.7).length, color: C.green },
          { label: "Laag betrouwbaar", value: saved.filter(r => (r.confidence || 0) <= 0.4).length, color: C.amber },
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

      {/* Zoekbalk */}
      <input
        placeholder="Zoek op spotnaam..."
        value={searchQ}
        onChange={e => setSearchQ(e.target.value)}
        style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 13, color: C.navy, background: C.card, outline: "none", marginBottom: 14, boxSizing: "border-box" as const }}
      />

      {/* Lijst */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>
          Geen opgeslagen enrichment data gevonden.
        </div>
      ) : filtered.map(row => {
        const spot = getSpot(row.spot_id);
        const conf = row.confidence || 0;
        const isEditing = editId === row.spot_id;
        const catCount = Object.values(row.categories || {}).filter(Boolean).length;

        return (
          <div key={row.spot_id} style={{
            background: C.card, borderRadius: 14, marginBottom: 10, boxShadow: C.cardShadow,
            border: `1px solid ${isEditing ? C.sky : C.cardBorder}`,
            transition: "border-color 0.2s",
          }}>
            {/* Row header */}
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{spot?.display_name || `Spot #${row.spot_id}`}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {spot?.region} · {catCount} categorie{catCount !== 1 ? "ën" : ""} · {new Date(row.updated_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>

              {/* Betrouwbaarheid badge */}
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, flexShrink: 0,
                background: conf > 0.7 ? "#DCFCE7" : conf > 0.4 ? "#FEF3C7" : "#FEE2E2",
                color: conf > 0.7 ? "#166534" : conf > 0.4 ? "#92400E" : "#991B1B",
              }}>
                {Math.round(conf * 100)}%
              </span>

              {/* Nieuws score badge */}
              {row.news_score != null && (
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, flexShrink: 0,
                  background: row.news_score >= 7 ? "#DBEAFE" : "#F3F4F6",
                  color: row.news_score >= 7 ? "#1D4ED8" : C.muted,
                }} title="Nieuws relevantiescore (7+ = push)">
                  📰 {row.news_score}/10
                </span>
              )}

              {/* Acties */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleBlock(row.spot_id, !!row.news_push_blocked)} style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: row.news_push_blocked ? "#FEF3C7" : "#F0FDF4",
                  color: row.news_push_blocked ? "#92400E" : "#166534",
                  border: `1px solid ${row.news_push_blocked ? "#FDE68A" : "#BBF7D0"}`,
                }} title={row.news_push_blocked ? "Push geblokkeerd — klik om te deblokkeren" : "Push actief — klik om te blokkeren"}>
                  {row.news_push_blocked ? "🔕 Geblokkeerd" : "🔔 Push aan"}
                </button>
                <button onClick={() => isEditing ? setEditId(null) : startEdit(row)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: isEditing ? C.creamDark : `${C.sky}15`,
                  color: isEditing ? C.muted : C.sky,
                  border: `1px solid ${isEditing ? C.cardBorder : `${C.sky}40`}`,
                }}>
                  {isEditing ? "Annuleer" : "✏️ Bewerken"}
                </button>
                <button onClick={() => deleteRow(row.spot_id, spot?.display_name || `Spot #${row.spot_id}`)} style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA",
                }}>🗑️</button>
              </div>
            </div>

            {/* Edit mode */}
            {isEditing && (
              <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "14px 16px" }}>
                {/* Taalwissel */}
                {Object.keys(editAllLangs).length > 1 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {Object.keys(editAllLangs).map(lang => (
                      <button key={lang} onClick={() => {
                        // Sla huidige taal op voordat je wisselt
                        setEditAllLangs(prev => ({ ...prev, [editLang]: editCats }));
                        setEditLang(lang);
                        setEditCats(editAllLangs[lang] || {});
                      }} style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1px solid ${editLang === lang ? C.sky : C.cardBorder}`,
                        background: editLang === lang ? C.sky : C.creamDark,
                        color: editLang === lang ? "#fff" : C.muted, cursor: "pointer",
                      }}>{lang.toUpperCase()}</button>
                    ))}
                  </div>
                )}
                {Object.entries(editCats).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: C.sky }}>{EnrichmentIcons[key]?.()}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                        {labels[key] || key}
                      </span>
                    </div>
                    <textarea
                      value={value}
                      onChange={e => setEditCats(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%", padding: "9px 12px", fontSize: 13, color: "#374151",
                        lineHeight: 1.6, background: "#F9FAFB", borderRadius: 8,
                        border: `1.5px solid ${C.cardBorder}`, outline: "none",
                        resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => saveEdit(row.spot_id, row)}
                  disabled={saving}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`,
                    color: "#fff", opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "⏳ Opslaan..." : "💾 Wijzigingen opslaan"}
                </button>
              </div>
            )}

            {/* Preview mode — categorie pills */}
            {!isEditing && (
              <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {Object.entries(row.categories || {}).filter(([, v]) => v).map(([key]) => (
                  <span key={key} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 600,
                    background: C.creamDark, color: C.muted,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ color: C.sky, opacity: 0.8, display: "inline-flex" }}>{EnrichmentIcons[key]?.()}</span>
                    {labels[key] || key}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── Content → Spots Tab ──

export { EnrichmentBeheerTab };