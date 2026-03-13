"use client";
import { useEffect, useState } from "react";
import { C, getLand, LAND_VLAG } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

interface NieuwsRow {
  spot_id: number;
  news_score: number | null;
  news_push_blocked: boolean;
  last_news_push_at: string | null;
  scanned_at: string | null;
  categories: any;
  spot_name: string;
  region: string;
  country: string;
}

function NieuwsOverzichtTab() {
  const [rows, setRows] = useState<NieuwsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [filter, setFilter] = useState<"all" | "gepusht" | "gefilterd" | "geblokkeerd">("all");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [enrichRes, spotsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?select=spot_id,news_score,news_push_blocked,last_news_push_at,scanned_at,categories&order=news_score.desc.nullslast`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,region,country&limit=5000`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
      ]);

      const spotMap: Record<number, any> = {};
      if (Array.isArray(spotsRes)) spotsRes.forEach((s: any) => { spotMap[s.id] = s; });

      const combined: NieuwsRow[] = Array.isArray(enrichRes)
        ? enrichRes.map((e: any) => ({
            ...e,
            spot_name: spotMap[e.spot_id]?.display_name || `#${e.spot_id}`,
            region: spotMap[e.spot_id]?.region || "",
            country: spotMap[e.spot_id]?.country || "",
          }))
        : [];

      setRows(combined);
    } catch {}
    setLoading(false);
  }

  async function toggleBlock(spot_id: number, current: boolean) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot_id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ news_push_blocked: !current }),
      });
      setRows(prev => prev.map(r => r.spot_id === spot_id ? { ...r, news_push_blocked: !current } : r));
      setMsg(current ? "✓ Blokkering opgeheven" : "✓ Push geblokkeerd voor deze spot");
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("❌ Opslaan mislukt"); }
  }

  function getNewsText(row: NieuwsRow): string {
    const cats = row.categories || {};
    const isNL = row.country === "NL" || row.country === "Netherlands" || row.country === "Nederland";
    const layer = isNL ? (cats.nl || cats.en || cats) : (cats.en || cats.nl || cats);
    return layer?.news || "";
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (diff < 1) return "zojuist";
    if (diff < 24) return `${diff}u geleden`;
    const days = Math.floor(diff / 24);
    if (days < 7) return `${days}d geleden`;
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  function getStatus(row: NieuwsRow): "gepusht" | "gefilterd" | "geblokkeerd" | "geen_score" {
    if (row.news_score === null) return "geen_score";
    if (row.news_push_blocked) return "geblokkeerd";
    if (row.news_score >= 7) return "gepusht";
    return "gefilterd";
  }

  const filtered = rows.filter(r => {
    const news = getNewsText(r);
    if (!news && filter !== "all") return false;
    const matchSearch = searchQ.length < 2 || r.spot_name.toLowerCase().includes(searchQ.toLowerCase());
    const status = getStatus(r);
    const matchFilter = filter === "all" ? (r.news_score !== null && news) : status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    gepusht: rows.filter(r => getStatus(r) === "gepusht").length,
    gefilterd: rows.filter(r => getStatus(r) === "gefilterd").length,
    geblokkeerd: rows.filter(r => getStatus(r) === "geblokkeerd").length,
  };

  const filterTabs: { key: typeof filter; label: string; count: number; color: string; bg: string }[] = [
    { key: "all", label: "Alle", count: counts.gepusht + counts.gefilterd + counts.geblokkeerd, color: C.navy, bg: C.creamDark },
    { key: "gepusht", label: "✅ Gepusht (≥7)", count: counts.gepusht, color: "#065F46", bg: "#ECFAF4" },
    { key: "gefilterd", label: "🟡 Gefilterd (<7)", count: counts.gefilterd, color: "#92400E", bg: "#FEF3C7" },
    { key: "geblokkeerd", label: "🔕 Geblokkeerd", count: counts.geblokkeerd, color: "#DC2626", bg: "#FEE2E2" },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Gepusht (≥7)", value: counts.gepusht, color: "#065F46", bg: "#ECFAF4" },
          { label: "Gefilterd (<7)", value: counts.gefilterd, color: "#92400E", bg: "#FEF3C7" },
          { label: "Geblokkeerd", value: counts.geblokkeerd, color: "#DC2626", bg: "#FEE2E2" },
          { label: "Totaal met nieuws", value: counts.gepusht + counts.gefilterd + counts.geblokkeerd, color: C.sky, bg: "#EFF8FB" },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${k.color}20` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div style={{ background: "#EFF8FB", border: `1px solid ${C.sky}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.sky }}>
        Scores worden elke maandag berekend. Na de push om 18:00 worden alle scores gereset en geblokkeerde spots vrijgegeven.
        Overzicht-email gaat naar <strong>feijekooistra@hotmail.com</strong>.
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 700,
          background: msg.startsWith("✓") ? "#DCFCE7" : "#FEF2F2",
          color: msg.startsWith("✓") ? "#166534" : "#DC2626",
        }}>{msg}</div>
      )}

      {/* Filter tabs + zoek */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" as const }}>
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${filter === t.key ? t.color : C.cardBorder}`,
            background: filter === t.key ? t.bg : C.card,
            color: filter === t.key ? t.color : C.muted,
          }}>
            {t.label} ({t.count})
          </button>
        ))}
        <input
          placeholder="Zoek spot..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, color: C.navy, background: C.card, outline: "none", width: 200 }}
        />
      </div>

      {/* Tabel */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center" as const, padding: "40px 20px", color: C.muted, fontSize: 13 }}>
          {rows.filter(r => r.news_score !== null).length === 0
            ? "Nog geen nieuws-scores — scan draait elke maandag om 07:00."
            : "Geen resultaten voor deze filter."}
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 12, overflow: "hidden", boxShadow: C.cardShadow }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.creamDark }}>
                <th style={{ padding: "9px 14px", textAlign: "left" as const, fontWeight: 700, color: C.sub, fontSize: 11 }}>SPOT</th>
                <th style={{ padding: "9px 10px", textAlign: "center" as const, fontWeight: 700, color: C.sub, fontSize: 11 }}>SCORE</th>
                <th style={{ padding: "9px 10px", textAlign: "left" as const, fontWeight: 700, color: C.sub, fontSize: 11 }}>NIEUWS</th>
                <th style={{ padding: "9px 10px", textAlign: "left" as const, fontWeight: 700, color: C.sub, fontSize: 11 }}>LAATSTE PUSH</th>
                <th style={{ padding: "9px 14px", textAlign: "right" as const, fontWeight: 700, color: C.sub, fontSize: 11 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const status = getStatus(row);
                const newsText = getNewsText(row);
                const statusColors = {
                  gepusht: { bg: "#ECFAF4", color: "#065F46" },
                  gefilterd: { bg: "#FEF3C7", color: "#92400E" },
                  geblokkeerd: { bg: "#FEE2E2", color: "#DC2626" },
                  geen_score: { bg: C.creamDark, color: C.muted },
                };
                const sc = statusColors[status];
                return (
                  <tr key={row.spot_id} style={{ borderTop: i > 0 ? `1px solid ${C.cardBorder}` : "none" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 700, color: C.navy }}>{row.spot_name}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{LAND_VLAG[getLand(row.region)] || "🌍"} {row.region}</div>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" as const }}>
                      {row.news_score !== null ? (
                        <span style={{ background: sc.bg, color: sc.color, fontWeight: 800, padding: "3px 9px", borderRadius: 6, fontSize: 13 }}>
                          {row.news_score}
                        </span>
                      ) : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px", maxWidth: 340 }}>
                      {newsText ? (
                        <span style={{ color: row.news_push_blocked ? C.muted : C.navy, fontSize: 12, lineHeight: 1.5 }}>
                          {newsText.length > 180 ? newsText.substring(0, 177) + "…" : newsText}
                        </span>
                      ) : <span style={{ color: C.muted, fontSize: 11 }}>Geen nieuws</span>}
                    </td>
                    <td style={{ padding: "10px", color: C.muted, whiteSpace: "nowrap" as const, fontSize: 11 }}>
                      {formatDate(row.last_news_push_at)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" as const }}>
                      {row.news_score !== null && (
                        <button
                          onClick={() => toggleBlock(row.spot_id, row.news_push_blocked)}
                          title={row.news_push_blocked ? "Blokkering opheffen" : "Nieuws-push blokkeren"}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            border: `1px solid ${row.news_push_blocked ? "#A7F3D0" : "#FECACA"}`,
                            background: row.news_push_blocked ? "#ECFDF5" : "#FEF2F2",
                            color: row.news_push_blocked ? "#065F46" : "#DC2626",
                          }}
                        >
                          {row.news_push_blocked ? "🔔 Deblokkeer" : "🔕 Blokkeer"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { NieuwsOverzichtTab };
