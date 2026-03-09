"use client";
import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { Icons } from "@/components/Icons";
import { getValidToken, getEmail, getAuthId, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import Prikbord, { PrikbordPost } from "@/components/Prikbord";
const h = { fontFamily: fonts.heading };
const SMIN = 5, SMAX = 50, SIZE = 280, CTR = 140, SEG = 16, SEG_A = 22.5, IR = 22, OR = CTR - 16;
const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const EXPAND: Record<string, string[]> = { N:["NNW","N","NNE"], NE:["NNE","NE","ENE"], E:["ENE","E","ESE"], SE:["ESE","SE","SSE"], S:["SSE","S","SSW"], SW:["SSW","SW","WSW"], W:["WSW","W","WNW"], NW:["WNW","NW","NNW"] };
const typeColors: Record<string, string> = { Zee: "#2E8FAE", Meer: "#3EAA8C", Rivier: "#E8A83E" };
function normA(a: number) { return ((a % 360) + 360) % 360; }
function pct(v: number) { return ((v - SMIN) / (SMAX - SMIN)) * 100; }
function valFromPct(p: number) { return Math.round(SMIN + (p / 100) * (SMAX - SMIN)); }
async function sbGet(path: string) {
  const token = await getValidToken(); if (!token) throw new Error("auth");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("auth"); if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json();
}
async function sbUpsert(table: string, data: any) {
  const token = await getValidToken(); if (!token) throw new Error("auth");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error("auth");
  if (!res.ok) {
    const patchUrl = `${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${data.user_id}&spot_id=eq.${data.spot_id}`;
    const patchRes = await fetch(patchUrl, { method: "PATCH", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(data) });
    if (!patchRes.ok) { const t = await patchRes.text(); throw new Error(`upsert_${patchRes.status}_${t}`); }
  }
}
function WindSlider({ min, max, onChange, color = C.sky }: { min: number; max: number; onChange: (mn: number, mx: number) => void; color?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);
  const propsRef = useRef({ onChange, min, max });
  propsRef.current = { onChange, min, max };
  useEffect(() => {
    const onM = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !trackRef.current) return;
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const r = trackRef.current.getBoundingClientRect();
      const p = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100));
      const v = valFromPct(p);
      const { onChange: fn, min: mn, max: mx } = propsRef.current;
      if (dragging.current === "min") fn(Math.min(v, mx - 1), mx);
      else fn(mn, Math.max(v, mn + 1));
    };
    const onU = () => { dragging.current = null; };
    document.addEventListener("mousemove", onM);
    document.addEventListener("touchmove", onM, { passive: false });
    document.addEventListener("mouseup", onU);
    document.addEventListener("touchend", onU);
    return () => {
      document.removeEventListener("mousemove", onM);
      document.removeEventListener("touchmove", onM);
      document.removeEventListener("mouseup", onU);
      document.removeEventListener("touchend", onU);
    };
  }, []);
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "16px 18px", boxShadow: C.cardShadow, border: color !== C.sky ? `1.5px solid ${color}25` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color }}>{min}</div><div style={{ fontSize: 10, color: C.sub, letterSpacing: 0.5 }}>MIN</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color }}>{max}</div><div style={{ fontSize: 10, color: C.sub, letterSpacing: 0.5 }}>MAX</div></div>
      </div>
      <div ref={trackRef} style={{ position: "relative", width: "100%", height: 4, background: C.creamDark, borderRadius: 2, margin: "14px 0", cursor: "pointer" }}
        onClick={(e) => { const r = trackRef.current!.getBoundingClientRect(); const p = ((e.clientX - r.left) / r.width) * 100; const v = valFromPct(p); if (Math.abs(v - min) < Math.abs(v - max)) onChange(Math.min(v, max - 1), max); else onChange(min, Math.max(v, min + 1)); }}>
        <div style={{ position: "absolute", height: "100%", left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%`, background: `linear-gradient(90deg, ${color}, ${color}99)`, borderRadius: 2 }} />
        {(["min", "max"] as const).map((w) => (
          <div key={w} onMouseDown={(e) => { e.preventDefault(); dragging.current = w; }} onTouchStart={(e) => { e.preventDefault(); dragging.current = w; }}
            style={{ position: "absolute", top: "50%", left: `${pct(w === "min" ? min : max)}%`, width: 18, height: 18, background: color, border: "2.5px solid #fff", borderRadius: "50%", transform: "translate(-50%,-50%)", cursor: "grab", boxShadow: "0 1px 6px rgba(0,0,0,0.25)", zIndex: 2, touchAction: "none" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.sub }}><span>{SMIN} kn</span><span>{SMAX} kn</span></div>
    </div>
  );
}

/* ── Strip cite tags from enrichment text ── */
function stripCiteSpot(text: string): string {
  if (!text) return text;
  return text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, '$1').trim();
}

/* ── Enrichment Info Tab Component ── */
function EnrichmentInfoTab({ spot, enrichment }: { spot: any; enrichment: any }) {
  const cats = enrichment?.categories || {};
  const hasEnrichment = enrichment && Object.values(cats).some(Boolean);
  const conf = enrichment?.confidence || 0;
  const scannedAt = enrichment?.scanned_at
    ? new Date(enrichment.scanned_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div>
      {/* Basis spot info */}
      <div style={{ background: C.card, borderRadius: 14, padding: "16px 18px", boxShadow: C.cardShadow, marginBottom: 16 }}>
        {spot.tips && (
          <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, margin: "0 0 14px" }}>{spot.tips}</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16 }}>
          {spot.good_directions?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Richtingen</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.sky }}>{spot.good_directions.join(", ")}</div>
            </div>
          )}
          {spot.min_wind && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Windrange</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.sky }}>{spot.min_wind}–{spot.max_wind} kn</div>
            </div>
          )}
          {spot.level && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Level</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{spot.level}</div>
            </div>
          )}
          {spot.region && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Regio</div>
              <div style={{ fontSize: 13, color: C.muted }}>{spot.region}</div>
            </div>
          )}
        </div>
      </div>

      {!hasEnrichment ? (
        <div style={{ background: C.card, borderRadius: 14, padding: "28px 18px", boxShadow: C.cardShadow, textAlign: "center" as const }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Nog geen uitgebreide info</div>
          <div style={{ fontSize: 12, color: C.muted }}>Deze spot wordt binnenkort gescand.</div>
        </div>
      ) : (
        <>
          {/* Meta */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
            <span style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 6, fontWeight: 700,
              background: conf > 0.7 ? "#DCFCE7" : conf > 0.4 ? "#FEF3C7" : "#FEE2E2",
              color: conf > 0.7 ? "#166534" : conf > 0.4 ? "#92400E" : "#991B1B",
            }}>
              {conf > 0.7 ? "✓ Betrouwbaar" : conf > 0.4 ? "~ Redelijk betrouwbaar" : "! Weinig info"}
            </span>
            {scannedAt && <span style={{ fontSize: 11, color: C.muted }}>Gescand {scannedAt}</span>}
          </div>

          {/* Nieuws — speciale blauwe card bovenaan */}
          {cats.news && (
            <div style={{
              background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
              border: "1.5px solid #BFDBFE", borderRadius: 14,
              padding: "14px 16px", marginBottom: 12,
              boxShadow: "0 2px 8px rgba(59,130,246,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#1D4ED8", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Nieuws</span>
                <span style={{ fontSize: 10, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 7px", borderRadius: 4, fontWeight: 700 }}>Actueel</span>
              </div>
              <div style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.7 }}>{stripCiteSpot(cats.news)}</div>
            </div>
          )}

          {/* Events — gele card */}
          {cats.events && (
            <div style={{
              background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
              border: "1.5px solid #FDE68A", borderRadius: 14,
              padding: "14px 16px", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#92400E", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Events & wedstrijden</span>
              </div>
              <div style={{ fontSize: 13, color: "#78350F", lineHeight: 1.7 }}>{stripCiteSpot(cats.events)}</div>
            </div>
          )}

          {/* Overige categorieën */}
          {[
            { key: "conditions", label: "Windcondities",    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg> },
            { key: "hazards",    label: "Gevaren & regels", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> },
            { key: "facilities", label: "Faciliteiten",     icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
            { key: "tips",       label: "Tips",             icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z"/><path d="M10 21h4"/></svg> },
          ].filter(c => cats[c.key]).map(cat => (
            <div key={cat.key} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 10, boxShadow: C.cardShadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {cat.icon}
                <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>{cat.label}</span>
              </div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>{stripCiteSpot(cats[cat.key])}</div>
            </div>
          ))}

          {/* Bronnen */}
          {enrichment.sources?.length > 0 && (
            <div style={{ marginTop: 6, padding: "10px 14px", background: C.creamDark, borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Bronnen</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{enrichment.sources.join(" · ")}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Spot Detail Content ── */
function SpotDetailContent() {
  const searchParams = useSearchParams();
  const spotId = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spot, setSpot] = useState<any>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [enrichment, setEnrichment] = useState<any>(null); // ← NIEUW
  const [wMin, setWMin] = useState(15);
  const [wMax, setWMax] = useState(25);
  const [userSegs, setUserSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [userArc, setUserArc] = useState<[number, number] | null>(null);
  const [defaults, setDefaults] = useState<boolean[]>(new Array(16).fill(false));
  const [isSaved, setIsSaved] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [epicEnabled, setEpicEnabled] = useState(false);
  const [eMin, setEMin] = useState(15);
  const [eMax, setEMax] = useState(30);
  const [epicSegs, setEpicSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [epicArc, setEpicArc] = useState<[number, number] | null>(null);
  const [tideEnabled, setTideEnabled] = useState(false);
  const [tideRef, setTideRef] = useState<"HW" | "LW">("HW");
  const [tideBefore, setTideBefore] = useState(2);
  const [tideAfter, setTideAfter] = useState(1);
  const [mode, setMode] = useState<"select" | "map">("select");
  const [compassLayer, setCompassLayer] = useState<"good" | "epic">("good");
  const [compassLat, setCompassLat] = useState<number | null>(null);
  const [compassLng, setCompassLng] = useState<number | null>(null);
  const compassLatRef = useRef<number | null>(null);
  const compassLngRef = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [prikbordPosts, setPrikbordPosts] = useState<PrikbordPost[]>([]);
  const tabParam = searchParams.get("tab") as "info" | "prikbord" | "voorkeuren" | null;
  const [activeTab, setActiveTab] = useState<"info" | "prikbord" | "voorkeuren">(tabParam ?? "voorkeuren");
  const tabSetByData = useRef(false);
  useEffect(() => {
    if (tabParam) return;
    if (tabSetByData.current) return;
    if (loading) return;
    tabSetByData.current = true;
    setActiveTab(isSaved ? "prikbord" : "voorkeuren");
  }, [loading, isSaved, tabParam]);
  const mapRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const LRef = useRef<any>(null);
  const sweepRef = useRef<{ active: boolean; s: number | null; c: number | null }>({ active: false, s: null, c: null });
  const stateRef = useRef({ userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter });
  useEffect(() => { stateRef.current = { userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter }; }, [userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter]);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!spotId) { setError("No spot ID"); setLoading(false); return; }
    const email = getEmail();
    if (!email || isTokenExpired()) { window.location.href = "/login"; return; }
    Promise.all([
      sbGet(`spots?id=eq.${spotId}&select=*`),
      sbGet(`users?auth_id=eq.${encodeURIComponent(getAuthId() || "")}&select=id,name,min_wind_speed,max_wind_speed`),
      sbGet(`ideal_conditions?spot_id=eq.${spotId}&select=*`),
    ]).then(([spots, users, conds]) => {
      if (!spots?.length) { setError("Spot not found"); setLoading(false); return; }
      if (!users?.length) { setError("User not found"); setLoading(false); return; }
      const sp = spots[0]; const user = users[0];
      setSpot(sp); setUserId(user.id);
      if (user.name) setUserName(user.name);
      const existing = conds?.find((c: any) => c.user_id === user.id) || null;
      if (existing?.wind_min != null) { setWMin(existing.wind_min); setWMax(existing.wind_max); }
      else if (user.min_wind_speed != null) { setWMin(user.min_wind_speed); setWMax(user.max_wind_speed || 25); }
      if (existing?.compass_lat != null) { setCompassLat(existing.compass_lat); setCompassLng(existing.compass_lng); compassLatRef.current = existing.compass_lat; compassLngRef.current = existing.compass_lng; }
      if (existing?.directions?.length) {
        const segs = new Array(16).fill(false);
        DIRS.forEach((d, i) => { if (existing.directions.includes(d)) segs[i] = true; });
        setUserSegs(segs); setIsSaved(true); setHasEdits(true);
      } else if (sp.good_directions?.length) {
        const exp: Record<string, boolean> = {};
        sp.good_directions.forEach((d: string) => (EXPAND[d] || [d]).forEach((x: string) => { exp[x] = true; }));
        const defs = DIRS.map((d) => !!exp[d]);
        setDefaults(defs);
      }
      if (existing?.perfect_enabled) {
        setEpicEnabled(true);
        if (existing.perfect_wind_min != null) { setEMin(existing.perfect_wind_min); setEMax(existing.perfect_wind_max || 30); }
        if (existing.perfect_directions?.length) {
          const eSegs = new Array(16).fill(false);
          DIRS.forEach((d, i) => { if (existing.perfect_directions.includes(d)) eSegs[i] = true; });
          setEpicSegs(eSegs);
        }
      }
      if (existing?.tide_enabled) {
        setTideEnabled(true);
        if (existing.tide_reference) setTideRef(existing.tide_reference);
        if (existing.tide_hours_before != null) setTideBefore(existing.tide_hours_before);
        if (existing.tide_hours_after != null) setTideAfter(existing.tide_hours_after);
      }
      if (existing) setIsSaved(true);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });

    // Prikbord
    sbGet(`spot_posts?spot_id=eq.${spotId}&order=created_at.desc&limit=20&select=id,type,content,author_name,created_at,wind_speed,wind_dir`)
      .then(posts => setPrikbordPosts(posts || []))
      .catch(() => {});

    // Enrichment data ← NIEUW
    fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spotId}&select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length) setEnrichment(data[0]); })
      .catch(() => {});
  }, [spotId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l); }
    if (!(window as any).L) { const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => { LRef.current = (window as any).L; }; document.head.appendChild(s); }
    else LRef.current = (window as any).L;
  }, []);

  const satLayerRef = useRef<any>(null);
  const streetLayerRef = useRef<any>(null);
  const spotMarkerRef = useRef<any>(null);
  const [isSat, setIsSat] = useState(true);
  useEffect(() => {
    if (!spot || loading || !mapElRef.current) return;
    const tryInit = () => {
      if (!LRef.current) { setTimeout(tryInit, 200); return; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const L = LRef.current;
      const center = compassLatRef.current != null ? [compassLatRef.current, compassLngRef.current] : [spot.latitude, spot.longitude];
      const map = L.map(mapElRef.current!, { zoomControl: true, scrollWheelZoom: false, dragging: false, touchZoom: false, attributionControl: false }).setView(center, 13);
      L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution('<a href="https://leafletjs.com" style="font-size:9px;opacity:0.5;">Leaflet</a>').addTo(map);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
      const street = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18 });
      sat.addTo(map);
      satLayerRef.current = sat; streetLayerRef.current = street;
      const col = typeColors[spot.spot_type] || C.sky;
      if (spot.latitude && spot.longitude) {
        spotMarkerRef.current = L.circleMarker([spot.latitude, spot.longitude], { radius: 8, color: col, fillColor: col, fillOpacity: 0.8, weight: 2 }).addTo(map);
      }
      map.on("moveend", () => { if (!spotMarkerRef.current) return; const c = map.getCenter(); spotMarkerRef.current.setLatLng([c.lat, c.lng]); });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    };
    tryInit();
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [spot, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMapLayer() {
    if (!mapRef.current || !satLayerRef.current || !streetLayerRef.current) return;
    const map = mapRef.current;
    if (isSat) { map.removeLayer(satLayerRef.current); streetLayerRef.current.addTo(map); }
    else { map.removeLayer(streetLayerRef.current); satLayerRef.current.addTo(map); }
    setIsSat(!isSat);
  }
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (mode === "map") { map.dragging.enable(); map.touchZoom.enable(); map.scrollWheelZoom.enable(); }
    else { map.dragging.disable(); map.touchZoom.disable(); map.scrollWheelZoom.disable(); }
  }, [mode]);

  function segsToArc(segs: boolean[]): [number, number] | null {
    const active: number[] = [];
    for (let i = 0; i < SEG; i++) if (segs[i]) active.push(i);
    if (!active.length) return null;
    let start = active[0], end = active[active.length - 1];
    let contiguous = true;
    for (let j = 1; j < active.length; j++) { if (active[j] !== active[j - 1] + 1) { contiguous = false; break; } }
    if (!contiguous) {
      const all = new Set(active); let gapStart = -1;
      for (let i = 0; i < SEG; i++) { if (!all.has(i) && all.has((i + SEG - 1) % SEG)) { gapStart = i; break; } }
      if (gapStart >= 0) { let s = gapStart; while (!all.has(s)) s = (s + 1) % SEG; start = s; let e = (gapStart + SEG - 1) % SEG; end = e; }
    }
    const fromAngle = start * SEG_A - SEG_A / 2;
    const toAngle = end * SEG_A + SEG_A / 2;
    return [fromAngle, toAngle];
  }

  const drawPie = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const st = stateRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const hasUserSelection = st.userSegs.some(Boolean);
    if (!hasUserSelection && !st.isSaved) {
      const defArc = segsToArc(st.defaults);
      if (defArc) {
        const [from, to] = defArc;
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, OR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.fillStyle = "rgba(46,111,126,0.18)"; ctx.fill();
        ctx.strokeStyle = "rgba(46,111,126,0.4)"; ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (hasUserSelection) {
      const arc = st.userArc || segsToArc(st.userSegs);
      if (arc) {
        const [from, to] = arc;
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, OR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.fillStyle = "rgba(46,111,126,0.45)"; ctx.fill();
        ctx.strokeStyle = "rgba(46,111,126,0.8)"; ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    if (st.epicEnabled && st.epicSegs.some(Boolean)) {
      const arc = st.epicArc || segsToArc(st.epicSegs);
      if (arc) {
        const [from, to] = arc;
        const eR = OR * 0.72;
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, eR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.fillStyle = "rgba(212,146,46,0.45)"; ctx.fill();
        ctx.strokeStyle = "rgba(212,146,46,0.9)"; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, eR - 4, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    const sw = sweepRef.current;
    if (sw.active && sw.s !== null && sw.c !== null) {
      let s = normA(sw.s), e = normA(sw.c), d = e - s;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      let from: number, to: number; if (d >= 0) { from = s; to = s + d; } else { from = s + d; to = s; }
      const isEpic = st.compassLayer === "epic";
      const rad = isEpic ? OR * 0.72 : OR;
      const fc = isEpic ? "rgba(212,146,46,0.35)" : "rgba(46,111,126,0.35)";
      const sc = isEpic ? "rgba(212,146,46,0.8)" : "rgba(46,111,126,0.8)";
      ctx.beginPath(); ctx.moveTo(CTR, CTR); ctx.arc(CTR, CTR, rad, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); ctx.closePath();
      ctx.fillStyle = fc; ctx.fill(); ctx.strokeStyle = sc; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  }, []);
  useEffect(() => { drawPie(); }, [userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, drawPie]);

  function angleFromEvent(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const cx = ("touches" in e ? (e as TouchEvent).touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX : (e as MouseEvent).clientX) - r.left - CTR;
    const cy = ("touches" in e ? (e as TouchEvent).touches[0]?.clientY ?? (e as TouchEvent).changedTouches[0]?.clientY : (e as MouseEvent).clientY) - r.top - CTR;
    if (Math.sqrt(cx * cx + cy * cy) < IR) return null;
    let a = Math.atan2(cy, cx) * 180 / Math.PI + 90; if (a < 0) a += 360; return a;
  }
  function arcToSegs(sa: number, ea: number) {
    const segs = new Array(16).fill(false);
    let s = normA(sa), e = normA(ea), d = e - s;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    let from: number, to: number; if (d >= 0) { from = s; to = s + d; } else { from = s + d; to = s; }
    for (let i = 0; i < SEG; i++) {
      let a = i * SEG_A, t = a; while (t < from) t += 360; if (t <= to) { segs[i] = true; continue; }
      t = a - 360; while (t < from) t += 360; if (t <= to) segs[i] = true;
    }
    return segs;
  }
  function finishSweep() {
    const sw = sweepRef.current;
    if (sw.s !== null && sw.c !== null) {
      const d = Math.abs(sw.c - sw.s); const ad = d > 180 ? 360 - d : d;
      if (ad > 5) {
        const newSegs = arcToSegs(sw.s, sw.c);
        let s = normA(sw.s), e = normA(sw.c), diff = e - s;
        if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
        let from: number, to: number;
        if (diff >= 0) { from = s; to = s + diff; } else { from = s + diff; to = s; }
        const arc: [number, number] = [from, to];
        if (stateRef.current.compassLayer === "epic") { setEpicSegs(newSegs); setEpicArc(arc); }
        else { setUserSegs(newSegs); setUserArc(arc); setHasEdits(true); setIsSaved(false); }
      }
    }
    sweepRef.current = { active: false, s: null, c: null };
    drawPie();
  }
  const finishSweepRef = useRef(finishSweep);
  finishSweepRef.current = finishSweep;
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!sweepRef.current.active) return;
      if ("touches" in e) e.preventDefault();
      const canvas = canvasRef.current; if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const raw = "touches" in e ? e.touches[0] : e;
      if (!raw) return;
      const cx = raw.clientX - r.left - CTR;
      const cy = raw.clientY - r.top - CTR;
      if (Math.sqrt(cx * cx + cy * cy) < IR) return;
      let a = Math.atan2(cy, cx) * 180 / Math.PI + 90; if (a < 0) a += 360;
      sweepRef.current.c = a;
      drawPie();
    };
    const onUp = () => { if (sweepRef.current.active) finishSweepRef.current(); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [drawPie]);
  function onCanvasDown(e: React.MouseEvent | React.TouchEvent) {
    if (mode !== "select") return;
    const a = angleFromEvent(e.nativeEvent); if (a === null) return;
    sweepRef.current = { active: true, s: a, c: a };
    e.preventDefault(); e.stopPropagation();
  }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function doSave(showFeedback = true) {
    if (!spot || !userId) return;
    const st = stateRef.current;
    const dirs: string[] = [];
    for (let i = 0; i < SEG; i++) if (st.userSegs[i]) dirs.push(DIRS[i]);
    if (!dirs.length && !st.hasEdits) for (let i = 0; i < SEG; i++) if (st.defaults[i]) dirs.push(DIRS[i]);
    const eDirs: string[] = [];
    if (st.epicEnabled) for (let i = 0; i < SEG; i++) if (st.epicSegs[i]) eDirs.push(DIRS[i]);
    const mapCenter = mapRef.current?.getCenter();
    try {
      await Promise.all([
        sbUpsert("user_spots", { user_id: userId, spot_id: spot.id }),
        sbUpsert("ideal_conditions", {
          user_id: userId, spot_id: spot.id, wind_min: st.wMin, wind_max: st.wMax, directions: dirs, enabled: true,
          perfect_enabled: st.epicEnabled, perfect_wind_min: st.epicEnabled ? st.eMin : null, perfect_wind_max: st.epicEnabled ? st.eMax : null,
          perfect_directions: st.epicEnabled ? eDirs : null, compass_lat: mapCenter?.lat ?? null, compass_lng: mapCenter?.lng ?? null,
          tide_enabled: st.tideEnabled, tide_reference: st.tideEnabled ? st.tideRef : null,
          tide_hours_before: st.tideEnabled ? st.tideBefore : null, tide_hours_after: st.tideEnabled ? st.tideAfter : null,
        }),
      ]);
      setIsSaved(true);
      if (showFeedback) showToast("✓ Saved");
    } catch (e: any) { if (showFeedback) showToast("Save failed"); }
  }
  async function handleSave() {
    if (!spot || !userId) return;
    if (epicEnabled && !epicSegs.some(Boolean)) { showToast("Select epic wind directions first"); return; }
    setSaving(true);
    await doSave(true);
    setSaving(false);
  }
  useEffect(() => {
    if (!isSaved || !userId || !spot) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { doSave(true); }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [wMin, wMax, userSegs, epicSegs, epicEnabled, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter]); // eslint-disable-line react-hooks/exhaustive-deps

  const userDirNames = DIRS.filter((_, i) => userSegs[i]);
  const defaultDirNames = !isSaved ? DIRS.filter((_, i) => defaults[i] && !userSegs[i]) : [];
  const epicDirNames = DIRS.filter((_, i) => epicSegs[i]);
  const labelR = CTR - 8;
  const labels = DIRS.map((d, i) => {
    const a = i * SEG_A; const r = (a - 90) * Math.PI / 180;
    return { d, x: CTR + Math.cos(r) * labelR, y: CTR + Math.sin(r) * labelR, isCard: i % 2 === 0 };
  });

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <div style={{ fontSize: 13, color: C.sub, marginTop: 10 }}>Loading spot...</div>
    </div>
  );
  if (error || !spot) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.amber, marginBottom: 8 }}>{error || "Spot not found"}</div>
      <a href="/spots" style={{ display: "inline-block", padding: "8px 20px", background: C.sky, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, textDecoration: "none" }}>Back to spots</a>
    </div>
  );

  const tc = typeColors[spot.spot_type] || C.sky;
  const TAB_ICONS: Record<string, React.ReactElement> = {
    prikbord: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    voorkeuren: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/></svg>,
  };
  const TABS: { key: "info" | "prikbord" | "voorkeuren"; label: string }[] = [
    { key: "prikbord", label: "Prikbord" },
    { key: "info", label: "Spot info" },
    { key: "voorkeuren", label: "Voorkeuren" },
  ];

  return (
    <>
      <a href="/spots" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.sky, textDecoration: "none", marginBottom: 16 }}>
        {Icons.arrowLeft({ color: C.sky, size: 16 })} Back to spots
      </a>
      <div style={{ marginBottom: 16 }}>
        <h1 className="font-bebas" style={{ ...h, fontSize: 30, letterSpacing: 1, color: C.navy, margin: "0 0 8px" }}>{spot.display_name}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {spot.spot_type && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.3, background: `${tc}20`, color: tc }}>{spot.spot_type}</span>}
          {spot.level && <span style={{ fontSize: 12, color: C.muted }}>Level: {spot.level}</span>}
          {spot.min_wind && <span style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>Wind: {spot.min_wind}–{spot.max_wind} kn</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: "#E2D8CC", borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'voorkeuren') { setTimeout(() => { mapRef.current?.invalidateSize(); }, 100); setTimeout(() => { mapRef.current?.invalidateSize(); }, 400); } }} style={{
            flex: 1, padding: "9px 8px", borderRadius: 9, border: "none",
            background: activeTab === tab.key ? "#FFFFFF" : "transparent",
            color: activeTab === tab.key ? C.navy : "#8A7A6A",
            fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            boxShadow: activeTab === tab.key ? "0 1px 6px rgba(0,0,0,0.10)" : "none",
            transition: "all 0.15s ease",
          }}>
            {TAB_ICONS[tab.key]}
            {tab.label}
            {tab.key === "prikbord" && prikbordPosts.length > 0 && (
              <span style={{ background: C.sky, color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                {prikbordPosts.length}
              </span>
            )}
            {tab.key === "info" && enrichment?.categories?.news && (
              <span style={{ background: "#3B82F6", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 5px" }}>!</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Spot info ── */}
      {activeTab === "info" && (
        <EnrichmentInfoTab spot={spot} enrichment={enrichment} />
      )}

      {/* ── TAB: Prikbord ── */}
      {activeTab === "prikbord" && (
        <Prikbord
          spotId={Number(spotId)}
          spotName={spot.display_name}
          userId={userId}
          userName={userName}
          posts={prikbordPosts}
          onPostAdded={(post) => setPrikbordPosts(prev => [post, ...prev])}
          showAll={true}
        />
      )}

      {/* ── TAB: Voorkeuren ── */}
      <div style={{ display: activeTab === "voorkeuren" ? "block" : "none" }}>
        <div style={{ position: "relative", width: "100%", height: "min(500px, 70vh)", borderRadius: 16, overflow: "hidden", marginBottom: 16, border: `1px solid ${C.cardBorder}` }}>
          <div ref={mapElRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
          <button onClick={toggleMapLayer} style={{ position: "absolute", top: 12, right: 12, zIndex: 1001, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
            {isSat ? "Map" : "Satellite"}
          </button>
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1001, display: "flex", background: "rgba(0,0,0,0.6)", borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", overflow: "hidden", border: `1px solid rgba(255,255,255,0.15)`, gap: 2, padding: 2 }}>
            {(["map", "select"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: mode === m ? (m === "select" ? C.sky : "rgba(255,255,255,0.2)") : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: mode === m ? "#fff" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                {m === "map" ? "📌 Position compass" : "🌊 Select wind"}
              </button>
            ))}
          </div>
          <div style={{ position: "absolute", zIndex: 1000, width: SIZE, height: SIZE, left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: mode === "select" ? "auto" : "none" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, rgba(46,111,126,0.1), rgba(46,111,126,0.04))", border: `2px solid ${compassLayer === "epic" ? "rgba(212,146,46,0.6)" : "rgba(46,111,126,0.25)"}`, boxShadow: compassLayer === "epic" ? "0 0 0 3px rgba(212,146,46,0.12)" : "0 0 0 3px rgba(46,111,126,0.06)", pointerEvents: "none" }} />
            <canvas ref={canvasRef} width={SIZE} height={SIZE} onMouseDown={onCanvasDown} onTouchStart={onCanvasDown} style={{ position: "absolute", inset: 0, borderRadius: "50%", zIndex: 2, cursor: mode === "select" ? "crosshair" : "default", touchAction: "none" }} />
            <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }} viewBox="0 0 280 280">
              <circle cx="140" cy="140" r="126" fill="none" stroke="rgba(46,111,126,0.2)" strokeWidth="1" />
              <circle cx="140" cy="140" r="42" fill="none" stroke="rgba(46,111,126,0.12)" strokeWidth="1" />
              <line x1="140" y1="18" x2="140" y2="262" stroke="rgba(46,111,126,0.15)" strokeWidth="1" />
              <line x1="18" y1="140" x2="262" y2="140" stroke="rgba(46,111,126,0.15)" strokeWidth="1" />
              <polygon points="140,30 134,140 140,128 146,140" fill="#C97A63" opacity="0.75" />
              <polygon points="140,250 134,140 140,152 146,140" fill="#94A3B8" opacity="0.45" />
            </svg>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: "#fff", border: `3px solid ${compassLayer === "epic" ? C.gold : C.sky}`, boxShadow: `0 0 0 5px ${compassLayer === "epic" ? "rgba(212,146,46,0.12)" : "rgba(46,111,126,0.12)"}`, zIndex: 20, pointerEvents: "none" }} />
            {labels.map((l) => (
              <div key={l.d} style={{ position: "absolute", left: l.x, top: l.y, transform: "translate(-50%,-50%)", fontSize: l.isCard ? 12 : 9, fontWeight: 700, color: l.isCard ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", pointerEvents: "none", zIndex: 5, letterSpacing: 0.3 }}>{l.d}</div>
            ))}
            <div style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", fontSize: 12, whiteSpace: "nowrap", fontWeight: 700, padding: "8px 16px", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", background: mode === "select" ? C.sky : C.card, color: mode === "select" ? "#fff" : C.navy, border: `1px solid ${C.cardBorder}` }}>
              {mode === "map" ? "Drag the map to position the compass" : "Sweep over water to select directions"}
            </div>
          </div>
        </div>
        {epicEnabled && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["good", "epic"] as const).map((l) => (
              <button key={l} onClick={() => setCompassLayer(l)} style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `2px solid ${compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.cardBorder}`, background: compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.card, fontSize: 13, fontWeight: 700, color: compassLayer === l ? "#fff" : C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: compassLayer === l ? "#fff" : (l === "good" ? C.sky : C.gold) }} />
                {l === "good" ? "Good" : "Epic"}
              </button>
            ))}
          </div>
        )}
        {hasEdits && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => { setUserSegs(new Array(16).fill(false)); setUserArc(null); setHasEdits(false); setIsSaved(false); }} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.cardBorder}`, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset to default</button>
            <button onClick={() => { setUserSegs(new Array(16).fill(false)); setUserArc(null); setHasEdits(false); }} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear selection</button>
          </div>
        )}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Wind Directions</h2>
          <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 12 }}>You'll only get pinged when wind comes from these directions</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
            {userDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: `${C.sky}20`, color: C.sky, border: `1px solid ${C.sky}40` }}>{d}</span>)}
            {defaultDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: C.creamDark, color: C.muted, border: `1px solid ${C.cardBorder}` }}>{d}</span>)}
            {!userDirNames.length && !defaultDirNames.length && <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Sweep over water on the compass above</span>}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Wind Speed Range</h2>
          <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 12 }}>You'll only get pinged when wind speed falls within this range</p>
          <WindSlider min={wMin} max={wMax} onChange={(mn, mx) => { setWMin(mn); setWMax(mx); }} />
        </div>
        <div onClick={() => { const next = !epicEnabled; setEpicEnabled(next); if (next) setCompassLayer("epic"); else setCompassLayer("good"); }} style={{ background: epicEnabled ? C.epicBg : C.card, border: `2px solid ${epicEnabled ? "#E8A83E" : C.cardBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: epicEnabled ? "#E8A83E" : C.navy, display: "flex", alignItems: "center", gap: 6 }}>🤙 Set Epic conditions</div>
            <div style={{ fontSize: 11, color: epicEnabled ? "#9A6830" : C.sub, fontStyle: "italic" }}>Get a special ping when conditions are perfect</div>
          </div>
          <div style={{ width: 48, height: 26, borderRadius: 13, background: epicEnabled ? "#E8A83E" : C.creamDark, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: epicEnabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.3s" }} />
          </div>
        </div>
        {epicEnabled && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#E8A83E", marginBottom: 4 }}>Epic Wind Speed</h2>
            <p style={{ fontSize: 12, color: "#9A6830", fontStyle: "italic", marginBottom: 12 }}>The perfect wind range for your session</p>
            <WindSlider min={eMin} max={eMax} onChange={(mn, mx) => { setEMin(mn); setEMax(mx); }} color="#E8A83E" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#E8A83E", marginTop: 20, marginBottom: 4 }}>Epic Wind Directions</h2>
            <p style={{ fontSize: 12, color: "#9A6830", fontStyle: "italic", marginBottom: 12 }}>Switch to "Epic" tab above and sweep on the compass</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
              {epicDirNames.length > 0 ? epicDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#E8A83E", border: "1px solid rgba(245,158,11,0.4)" }}>{d}</span>)
                : <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No epic directions selected yet</span>}
            </div>
            {epicDirNames.length > 0 && (
              <button onClick={() => { setEpicSegs(new Array(16).fill(false)); setEpicArc(null); }} style={{ marginTop: 10, padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(245,158,11,0.4)", color: "#E8A83E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear epic selection</button>
            )}
          </div>
        )}
        {spot.spot_type?.toLowerCase() === "zee" && (
          <>
            <div onClick={() => setTideEnabled(!tideEnabled)} style={{ background: tideEnabled ? C.oceanTint : C.card, border: `2px solid ${tideEnabled ? C.sky : C.cardBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: tideEnabled ? C.sky : C.navy, display: "flex", alignItems: "center", gap: 6 }}>🌊 Tide preferences</div>
                <div style={{ fontSize: 11, color: tideEnabled ? "rgba(46,143,174,0.7)" : C.sub, fontStyle: "italic" }}>Only get pinged during your preferred tide window</div>
              </div>
              <div style={{ width: 48, height: 26, borderRadius: 13, background: tideEnabled ? C.sky : C.creamDark, position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: tideEnabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.3s" }} />
              </div>
            </div>
            {tideEnabled && (
              <div style={{ marginBottom: 24, padding: "18px", background: C.oceanTint, borderRadius: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: C.sky, marginBottom: 12 }}>Tide Window</h2>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["HW", "LW"] as const).map((ref) => (
                    <button key={ref} onClick={() => setTideRef(ref)} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: `2px solid ${tideRef === ref ? C.sky : C.cardBorder}`, background: tideRef === ref ? C.sky : C.card, fontSize: 14, fontWeight: 700, color: tideRef === ref ? "#fff" : C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {ref === "HW" ? "▲" : "▼"} {ref === "HW" ? "High Water" : "Low Water"}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Hours before {tideRef}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{tideBefore}h</span>
                  </div>
                  <input type="range" min={0} max={5} step={0.5} value={tideBefore} onChange={(e) => setTideBefore(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.sky }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Hours after {tideRef}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{tideAfter}h</span>
                  </div>
                  <input type="range" min={0} max={5} step={0.5} value={tideAfter} onChange={(e) => setTideAfter(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.sky }} />
                </div>
                <div style={{ textAlign: "center", padding: "10px 0 4px", fontSize: 12, color: C.muted }}>
                  Alert window: <strong style={{ color: C.navy }}>{tideBefore}h before</strong> to <strong style={{ color: C.navy }}>{tideAfter}h after</strong> {tideRef}
                </div>
              </div>
            )}
          </>
        )}
        <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving..." : isSaved ? "Update preferences" : "Add to my spots"}
        </button>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: toast.includes("✓") ? C.green : C.amber, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10000 }}>{toast}</div>
      )}
    </>
  );
}

export default function SpotDetailPage() {
  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>
        <Suspense fallback={<div style={{ textAlign: "center", padding: 60 }}><div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /></div>}>
          <SpotDetailContent />
        </Suspense>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}