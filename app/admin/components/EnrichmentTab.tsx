"use client";
import { useEffect, useState } from "react";
import { C, getLand, LAND_VLAG, LAND_CODE } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Tip } from "./SharedUI";
import { EnrichmentResult } from "./EnrichmentResult";

function EnrichmentTab() {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [resultMap, setResultMap] = useState<Record<number, any>>({});
  const [viewId, setViewId] = useState<number | null>(null);
  const [scanProgress, setScanProgress] = useState("");
  const [spotSearch, setSpotSearch] = useState("");
  const [selectedLand, setSelectedLand] = useState<string | null>(null);
  const [selectedLanden, setSelectedLanden] = useState<Set<string>>(new Set());
  const [landLimits, setLandLimits] = useState<Record<string, number>>({});
  const [triggerMsg, setTriggerMsg] = useState("");
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [cronPolling, setCronPolling] = useState(false);
  const [cronProgress, setCronProgress] = useState<{ done: number; total: number; recent: string[] }>({ done: 0, total: 0, recent: [] });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?order=display_name.asc&select=id,display_name,spot_type,region,latitude,longitude&limit=5000`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Range-Unit": "items", "Range": "0-4999" }
        });
        const data = await res.json();
        setSpots(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filteredSpots = spots.filter(s => {
    const matchSearch = spotSearch.length >= 2 ? s.display_name.toLowerCase().includes(spotSearch.toLowerCase()) : true;
    const matchLand = selectedLand ? getLand(s.region) === selectedLand
      : selectedLanden.size > 0 ? selectedLanden.has(getLand(s.region))
      : true;
    return matchSearch && matchLand;
  });

  function toggleCheck(id: number) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === filteredSpots.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredSpots.map((s: any) => s.id)));
    }
  }

  function toggleLand(land: string) {
    setSelectedLanden(prev => {
      const next = new Set(prev);
      if (next.has(land)) next.delete(land); else next.add(land);
      return next;
    });
  }

  async function startCronPolling(total: number, spotIds: number[]) {
    setCronPolling(true);
    setCronProgress({ done: 0, total, recent: [] });
    const start = Date.now();
    const maxWait = 30 * 60 * 1000; // max 30 min polling
    let lastDone = 0;
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 15000)); // poll elke 15s
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=in.(${spotIds.join(",")})&select=spot_id,scanned_at&order=scanned_at.desc`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          const done = data.length;
          const recentIds = data.slice(0, 3).map((r: any) => r.spot_id);
          const recentNames = recentIds.map((id: number) => spots.find(s => s.id === id)?.display_name || `#${id}`);
          setCronProgress({ done, total, recent: recentNames });
          if (done >= total) break;
          lastDone = done;
        }
      } catch {}
    }
    setCronPolling(false);
    setTriggerMsg(`✓ Klaar — ${lastDone || total} spots gescand`);
    setTimeout(() => setTriggerMsg(""), 8000);
  }

  async function triggerCron(mode: string) {
    if (selectedLanden.size === 0 && mode !== "active") {
      setTriggerMsg("Selecteer eerst een of meer landen");
      setTimeout(() => setTriggerMsg(""), 3000);
      return;
    }
    setTriggerLoading(true);
    setTriggerMsg("Bezig...");
    try {
      if (mode === "active") {
        if (!confirm("Alle actieve spots opnieuw scannen? Dit kan lang duren.")) { setTriggerLoading(false); return; }
        const res = await fetch(`/api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=active`);
        const data = await res.json();
        const queued = data.queued || 0;
        setTriggerMsg(`✓ ${queued} spots ingepland voor refresh`);
        if (queued > 0 && data.spot_ids?.length) startCronPolling(queued, data.spot_ids);
      } else {
        const landen = Array.from(selectedLanden);
        let totaal = 0;
        let allSpotIds: number[] = [];
        for (const land of landen) {
          const limit = landLimits[land] || 10;
          const countryCode = LAND_CODE[land] || land;
          const res = await fetch(`/api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=new_only&limit=${limit}&country=${countryCode}`);
          const data = await res.json();
          totaal += data.queued || 0;
          if (data.spot_ids) allSpotIds = [...allSpotIds, ...data.spot_ids];
        }
        setTriggerMsg(`✓ ${totaal} spots ingepland (${landen.join(", ")})`);
        if (totaal > 0 && allSpotIds.length) startCronPolling(totaal, allSpotIds);
      }
    } catch { setTriggerMsg("❌ Mislukt"); }
    setTriggerLoading(false);
  }

  async function triggerNieuws() {
    if (!confirm("Nieuws-check starten voor alle actieve spots?")) return;
    setTriggerLoading(true);
    setTriggerMsg("Nieuws-check starten...");
    try {
      const res = await fetch(`/api/enrichment-news-trigger?key=WindPing-cron-key-2026`);
      const data = await res.json();
      setTriggerMsg(`✓ Nieuws-check gestart: ${data.queued} spots`);
    } catch { setTriggerMsg("❌ Mislukt"); }
    setTriggerLoading(false);
    setTimeout(() => setTriggerMsg(""), 5000);
  }

  async function scanChecked() {
    const toScan = spots.filter(s => checkedIds.has(s.id));
    if (toScan.length === 0) return;
    setScanning(true);
    for (let i = 0; i < toScan.length; i++) {
      const spot = toScan[i];
      setScanProgress(`${i + 1}/${toScan.length}: ${spot.display_name}`);
      let retries = 0;
      while (retries < 3) {
        try {
          const res = await fetch("/api/enrichment-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spot }),
          });
          const data = await res.json();

          if (res.status === 429 || JSON.stringify(data).includes("rate_limit")) {
            retries++;
            const wait = 15 * retries;
            for (let s = wait; s > 0; s--) {
              setScanProgress(`⏳ Rate limit — wacht ${s}s (${i + 1}/${toScan.length})`);
              await new Promise(r => setTimeout(r, 1000));
            }
            continue;
          }

          const hasCreditsError = data?.error?.type === "insufficient_credits" || 
            (data?.error && String(data.error).toLowerCase().includes("credit")) ||
            data?.type === "error" && data?.error?.message?.toLowerCase().includes("credit");
          const spotResult = hasCreditsError ? { error: "insufficient_credits" } : data;
          setResultMap(prev => ({ ...prev, [spot.id]: spotResult }));
          setViewId(spot.id);
          break;
        } catch {
          setResultMap(prev => ({ ...prev, [spot.id]: { error: "Scannen mislukt" } }));
          break;
        }
      }
      // 4s tussen spots om binnen 30k tokens/min te blijven (~15 spots/min max)
      if (i < toScan.length - 1) {
        for (let s = 15; s > 0; s--) {
          setScanProgress(`${i + 1}/${toScan.length}: ${spot.display_name} ✓ — volgende over ${s}s`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    setScanProgress("");
    setScanning(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  const checkedCount = checkedIds.size;
  const scannedSpots = spots.filter(s => resultMap[s.id]);

  const landenMap: Record<string, any[]> = {};
  spots.forEach(s => {
    const land = getLand(s.region);
    if (!landenMap[land]) landenMap[land] = [];
    landenMap[land].push(s);
  });
  const landenSorted = Object.entries(landenMap)
    .filter(([land]) => land !== "Overig")
    .sort((a, b) => b[1].length - a[1].length);

  const nlCount = (landenMap["Nederland"] || []).length;


  return (
    <div>
      {/* Header */}
      <div style={{ background: C.card, borderRadius: 12, padding: "14px 18px", marginBottom: 14, boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>Spot Enrichment Scanner</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Scant publieke informatie via AI per spot. Scan spots en sla de resultaten op in de database.
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.sky, whiteSpace: "nowrap" as const, marginLeft: 16 }}>{spots.length} spots</span>
      </div>

      {/* Snelkeuze landen */}
      <div style={{ background: C.card, borderRadius: 10, padding: "10px 14px", marginBottom: 12, boxShadow: C.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, whiteSpace: "nowrap" as const }}>HANDMATIGE SCAN — FILTER OP LAND</span>
          {selectedLand && (
            <button onClick={() => setSelectedLand(null)} style={{
              padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700,
              border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
            }}>✕ {selectedLand}</button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {landenSorted.map(([land, ls]) => {
            const isActive = selectedLand === land;
            return (
              <button key={land} disabled={scanning} onClick={() => setSelectedLand(isActive ? null : land)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: isActive ? 700 : 600,
                border: `1px solid ${isActive ? C.sky : C.cardBorder}`,
                background: isActive ? C.sky : C.creamDark,
                color: isActive ? "#fff" : C.navy,
                cursor: scanning ? "default" : "pointer",
              }}>{LAND_VLAG[land] || "🌍"} {land} ({ls.length})</button>
            );
          })}
        </div>
      </div>

      {/* Cron trigger sectie */}
      <div style={{ background: C.card, borderRadius: 10, padding: "12px 14px", marginBottom: 12, boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10 }}>CRON TRIGGER — NIEUWE SPOTS INPLANNEN</div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 10 }}>
          {landenSorted.map(([land, ls]) => {
            const isActive = selectedLanden.has(land);
            return (
              <div key={land} style={{ display: "flex", alignItems: "center", gap: 4, background: isActive ? `${C.sky}10` : C.creamDark, border: `1px solid ${isActive ? C.sky : C.cardBorder}`, borderRadius: 8, padding: "4px 6px 4px 8px" }}>
                <button onClick={() => toggleLand(land)} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 11,
                  fontWeight: isActive ? 700 : 500, color: isActive ? C.sky : C.navy, padding: 0,
                }}>
                  {LAND_VLAG[land] || "🌍"} {land} ({ls.length})
                </button>
                {isActive && (
                  <input
                    type="number" min={1} max={ls.length} value={landLimits[land] ?? 10}
                    onChange={e => setLandLimits(prev => ({ ...prev, [land]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    style={{ width: 44, padding: "2px 4px", borderRadius: 5, border: `1px solid ${C.sky}40`, fontSize: 11, fontWeight: 700, color: C.navy, textAlign: "center" as const, background: "#fff" }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
          <button
            onClick={() => triggerCron("new_only")}
            disabled={triggerLoading || selectedLanden.size === 0}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: selectedLanden.size > 0 ? "pointer" : "not-allowed", background: selectedLanden.size > 0 ? C.sky : C.creamDark, color: selectedLanden.size > 0 ? "#fff" : C.muted, border: "none", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Scan nieuwe spots
          </button>
          <button
            onClick={() => triggerCron("active")}
            disabled={triggerLoading}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Jaarlijkse refresh (alle actieve)
          </button>
          <button
            onClick={triggerNieuws}
            disabled={triggerLoading}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Nieuws-check
          </button>
          {triggerMsg && (
            <span style={{ fontSize: 12, fontWeight: 700, color: triggerMsg.startsWith("✓") ? "#166534" : triggerMsg.startsWith("❌") ? "#DC2626" : C.sky }}>
              {triggerMsg}
            </span>
          )}
        </div>
        {cronPolling && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 14, height: 14, border: "2px solid #93C5FD", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8" }}>
                Scannen bezig — {cronProgress.done}/{cronProgress.total} spots verwerkt
              </span>
            </div>
            <div style={{ height: 6, background: "#DBEAFE", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", background: "#2563EB", borderRadius: 3, width: `${cronProgress.total > 0 ? Math.round((cronProgress.done / cronProgress.total) * 100) : 0}%`, transition: "width 0.5s ease" }} />
            </div>
            {cronProgress.recent.length > 0 && (
              <div style={{ fontSize: 11, color: "#3B82F6" }}>
                Recent: {cronProgress.recent.join(", ")}
              </div>
            )}
            <div style={{ fontSize: 10, color: "#93C5FD", marginTop: 4 }}>Elke 15 seconden bijgewerkt — cron verwerkt 3 spots per 5 min</div>
          </div>
        )}
      </div>

      {/* Geselecteerde spots strip */}
      {checkedCount > 0 && (
        <div style={{ background: `${C.sky}08`, border: `1px solid ${C.sky}20`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.sky, flexShrink: 0 }}>{checkedCount} geselecteerd:</span>
          {spots.filter(s => checkedIds.has(s.id)).slice(0, 15).map(s => (
            <span key={s.id} onClick={() => toggleCheck(s.id)} style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4, background: C.sky, color: "#fff",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            }}>{s.display_name} <span style={{ opacity: 0.7 }}>×</span></span>
          ))}
          {checkedCount > 15 && <span style={{ fontSize: 11, color: C.muted }}>+{checkedCount - 15} meer</span>}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={scanChecked}
            disabled={scanning || checkedCount === 0}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none",
              background: checkedCount > 0 ? C.sky : C.creamDark,
              color: checkedCount > 0 ? "#fff" : C.muted,
              cursor: (scanning || checkedCount === 0) ? "default" : "pointer",
              opacity: scanning ? 0.6 : 1,
            }}
          >
            {scanning ? `⏳ ${scanProgress}` : `🔍 Scan ${checkedCount > 0 ? `${checkedCount} geselecteerde spot${checkedCount > 1 ? "s" : ""}` : "geselecteerde spots"}`}
          </button>
          <Tip text="Vink spots aan in de lijst, dan hier op scannen klikken. Je kunt meerdere spots tegelijk selecteren en in één keer scannen." />
        </div>

        {checkedCount > 0 && !scanning && (
          <button onClick={() => { setCheckedIds(new Set()); setResultMap({}); setViewId(null); }} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: C.creamDark, border: `1px solid ${C.cardBorder}`, color: C.muted, cursor: "pointer" }}>
            Wis selectie
          </button>
        )}

        <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>{spots.length} spots totaal</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        {/* Spot lijst met checkboxes */}
        <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, display: "flex", flexDirection: "column", maxHeight: 640 }}>
          {/* Zoek + selecteer alle */}
          <div style={{ padding: "10px 10px 6px", borderBottom: `1px solid ${C.cardBorder}` }}>
            <input
              placeholder="Zoek spot..."
              value={spotSearch}
              onChange={e => setSpotSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, color: C.navy, background: C.creamDark, boxSizing: "border-box" as const, outline: "none", marginBottom: 6 }}
            />
            <button onClick={toggleAll} style={{ fontSize: 11, color: C.sky, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
              {checkedIds.size === filteredSpots.length && filteredSpots.length > 0 ? "✓ Alles deselecteren" : `Selecteer alle ${filteredSpots.length > 0 ? `(${filteredSpots.length})` : ""}`}
            </button>
          </div>

          <div style={{ overflowY: "auto" as const, flex: 1, padding: "4px 6px 8px" }}>
            {filteredSpots.map((spot: any) => {
              const checked = checkedIds.has(spot.id);
              const isScanning = scanning && scanProgress.includes(spot.display_name);
              return (
                <div
                  key={spot.id}
                  onClick={() => !scanning && toggleCheck(spot.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8,
                    marginBottom: 2, cursor: scanning ? "default" : "pointer",
                    background: checked ? `${C.sky}12` : "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${checked ? C.sky : C.cardBorder}`,
                    background: checked ? C.sky : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: checked ? 700 : 500, color: checked ? C.sky : C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spot.display_name}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{spot.region ? `${spot.region} · ` : ""}{spot.spot_type || "—"}</div>
                  </div>
                  {isScanning && <div style={{ width: 12, height: 12, border: `2px solid ${C.sky}40`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />}
                </div>
              );
            })}
            {filteredSpots.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, padding: "12px 10px" }}>Geen spots gevonden</div>
            )}
          </div>
        </div>

        {/* Resultaten */}
        <div style={{ background: C.card, borderRadius: 12, padding: 16, boxShadow: C.cardShadow, maxHeight: 640, overflowY: "auto" as const }}>
          {scanning && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid #93C5FD`, borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#1D4ED8" }}>{scanProgress}</span>
            </div>
          )}

          {/* Resultaten navigatie tabs als meerdere gescand */}
          {scannedSpots.length > 1 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
              {scannedSpots.map(spot => (
                <button key={spot.id} onClick={() => setViewId(spot.id)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                  background: viewId === spot.id ? C.sky : C.creamDark,
                  color: viewId === spot.id ? "#fff" : C.muted,
                }}>
                  {resultMap[spot.id]?.error ? "⚠️ " : "✅ "}{spot.display_name}
                </button>
              ))}
            </div>
          )}

          {viewId && resultMap[viewId] && (() => {
            const spot = spots.find(s => s.id === viewId);
            return spot ? <EnrichmentResult spot={spot} data={resultMap[viewId]} /> : null;
          })()}

          {scannedSpots.length === 0 && !scanning && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>☑️</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Vink spots aan</div>
              <div style={{ fontSize: 12, textAlign: "center" as const, lineHeight: 1.7 }}>
                Selecteer één of meerdere spots via de checkboxes links,<br />klik dan op de scan knop hierboven.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SVG Iconen voor enrichment categorieën ──

export { EnrichmentTab };
