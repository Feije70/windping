"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, CircleMarker, TileLayer } from "leaflet";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { Icons } from "@/components/Icons";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };
const SMIN = 5, SMAX = 50, SIZE = 280, CTR = 140, SEG = 16, SEG_A = 22.5, IR = 22, OR = CTR - 16;
const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function normA(a: number) { return ((a % 360) + 360) % 360; }
function pct(v: number) { return ((v - SMIN) / (SMAX - SMIN)) * 100; }
function valFromPct(p: number) { return Math.round(SMIN + (p / 100) * (SMAX - SMIN)); }

const TYPES = [
  { value: "Zee", label: "🌊 Sea" },
  { value: "Meer", label: "💧 Lake" },
  { value: "Rivier", label: "🏔️ River" },
  { value: "Overig", label: "📍 Other" },
];
const LEVELS = ["Beginners", "Alle niveaus", "Gevorderden"];

/* ── Wind Range Slider ── */
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
      const v = valFromPct(p); const { onChange: fn, min: mn, max: mx } = propsRef.current;
      if (dragging.current === "min") fn(Math.min(v, mx - 1), mx); else fn(mn, Math.max(v, mn + 1));
    };
    const onU = () => { dragging.current = null; };
    document.addEventListener("mousemove", onM); document.addEventListener("touchmove", onM, { passive: false });
    document.addEventListener("mouseup", onU); document.addEventListener("touchend", onU);
    return () => { document.removeEventListener("mousemove", onM); document.removeEventListener("touchmove", onM); document.removeEventListener("mouseup", onU); document.removeEventListener("touchend", onU); };
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

/* ── First Spot Popup ── */
function FirstSpotPopup({ spotName, onClose }: { spotName: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 24, padding: "36px 28px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🤙</div>
        <h2 style={{ ...h, fontSize: 26, fontWeight: 800, color: C.navy, margin: "0 0 10px" }}>Je bent er klaar voor!</h2>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: "0 0 8px" }}>Vanaf nu houden we de wind in de gaten voor</p>
        <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20, background: `${C.sky}20`, color: C.sky, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📍 {spotName}</div>
        <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, margin: "0 0 24px" }}>Je krijgt een ping zodra het waait. Tijd om je gear klaar te leggen. Je kunt altijd meer spots toevoegen of je instellingen aanpassen.</p>
        <button onClick={onClose} style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px ${C.sky}40` }}>
          Let's go! 🌊
        </button>
      </div>
      <style>{`@keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════ */
export default function AddSpotPage() {
  const { user, token, loading: authLoading } = useUser({ redirectIfUnauthenticated: true });

  const [name, setName] = useState("");
  const [spotType, setSpotType] = useState<string | null>(null);
  const [level, setLevel] = useState("Alle niveaus");
  const [tips, setTips] = useState("");
  const [spotLat, setSpotLat] = useState<number | null>(null);
  const [spotLng, setSpotLng] = useState<number | null>(null);
  const [wMin, setWMin] = useState(15);
  const [wMax, setWMax] = useState(25);
  const [userSegs, setUserSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [userArc, setUserArc] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<"map" | "select">("map");
  const [isSat, setIsSat] = useState(false);
  const [epicEnabled, setEpicEnabled] = useState(false);
  const [eMin, setEMin] = useState(15);
  const [eMax, setEMax] = useState(30);
  const [epicSegs, setEpicSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [epicArc, setEpicArc] = useState<[number, number] | null>(null);
  const [compassLayer, setCompassLayer] = useState<"good" | "epic">("good");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFirstSpotPopup, setShowFirstSpotPopup] = useState(false);
  const [savedSpotName, setSavedSpotName] = useState("");
  const fromOnboarding = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "onboarding";

  const mapRef = useRef<LeafletMap | null>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const sweepRef = useRef<{ active: boolean; s: number | null; c: number | null }>({ active: false, s: null, c: null });
  const satLayerRef = useRef<TileLayer | null>(null);
  const streetLayerRef = useRef<TileLayer | null>(null);
  const stateRef = useRef({ userSegs, userArc, epicSegs, epicArc, epicEnabled, compassLayer });
  useEffect(() => { stateRef.current = { userSegs, userArc, epicSegs, epicArc, epicEnabled, compassLayer }; }, [userSegs, userArc, epicSegs, epicArc, epicEnabled, compassLayer]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const pinPlaced = spotLat !== null;

  // Load user wind defaults once auth is ready
  useEffect(() => {
    if (!user || !token) return;
    fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=min_wind_speed,max_wind_speed`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((u) => { if (u?.[0]?.min_wind_speed != null) { setWMin(u[0].min_wind_speed); setWMax(u[0].max_wind_speed || 25); } })
      .catch(() => {});
  }, [user, token]);

  // Leaflet laden + kaart initialiseren
  useEffect(() => {
    if (authLoading || typeof window === "undefined" || !mapElRef.current) return;

    function initMap() {
      if (!mapElRef.current || mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as unknown as { L?: any }).L;
      if (!L) return;
      LRef.current = L;
      const map = L.map(mapElRef.current, { zoomControl: true, scrollWheelZoom: true, attributionControl: false }).setView([52.3, 5.0], 7);
      L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution('<a href="https://leafletjs.com" style="font-size:9px;opacity:0.5;">Leaflet</a>').addTo(map);
      const street = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18 });
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
      street.addTo(map);
      streetLayerRef.current = street; satLayerRef.current = sat;
      map.on("click", (e: unknown) => {
        const { lat, lng } = (e as { latlng: { lat: number; lng: number } }).latlng;
        setSpotLat(lat); setSpotLng(lng);
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.circleMarker([lat, lng], { radius: 8, color: C.sky, fillColor: C.sky, fillOpacity: 0.8, weight: 2 }).addTo(map);
        map.setView([lat, lng], 11);
      });
      map.on("moveend", () => {
        if (!markerRef.current) return;
        const center = map.getCenter();
        markerRef.current.setLatLng([center.lat, center.lng]);
        setSpotLat(center.lat); setSpotLng(center.lng);
      });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 800);
      fetch("https://ipapi.co/json/").then((r) => r.json()).then((d) => { if (d.latitude && d.longitude) map.setView([d.latitude, d.longitude], 9); }).catch(() => {});
    }

    if (!document.querySelector('link[href*="leaflet"]')) {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l);
    }
    if ((window as unknown as { L?: unknown }).L) {
      initMap();
    } else {
      const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => initMap();
      document.head.appendChild(s);
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMapLayer() {
    if (!mapRef.current) return;
    if (isSat) { if (satLayerRef.current) mapRef.current.removeLayer(satLayerRef.current); if (streetLayerRef.current) streetLayerRef.current.addTo(mapRef.current); }
    else { if (streetLayerRef.current) mapRef.current.removeLayer(streetLayerRef.current); if (satLayerRef.current) satLayerRef.current.addTo(mapRef.current); }
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
      const all = new Set(active);
      let gapStart = -1;
      for (let i = 0; i < SEG; i++) { if (!all.has(i) && all.has((i + SEG - 1) % SEG)) { gapStart = i; break; } }
      if (gapStart >= 0) {
        let s = gapStart;
        while (!all.has(s)) s = (s + 1) % SEG;
        start = s; end = (gapStart + SEG - 1) % SEG;
      }
    }
    return [start * SEG_A - SEG_A / 2, end * SEG_A + SEG_A / 2];
  }

  const drawPie = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const st = stateRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (st.userSegs.some(Boolean)) {
      const arc = st.userArc || segsToArc(st.userSegs);
      if (arc) {
        const [from, to] = arc;
        ctx.beginPath(); ctx.moveTo(CTR, CTR); ctx.arc(CTR, CTR, OR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); ctx.closePath();
        ctx.fillStyle = "rgba(46,111,126,0.45)"; ctx.fill(); ctx.strokeStyle = "rgba(46,111,126,0.8)"; ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    if (st.epicEnabled && st.epicSegs.some(Boolean)) {
      const arc = st.epicArc || segsToArc(st.epicSegs);
      if (arc) {
        const [from, to] = arc; const eR = OR * 0.72;
        ctx.beginPath(); ctx.moveTo(CTR, CTR); ctx.arc(CTR, CTR, eR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); ctx.closePath();
        ctx.fillStyle = "rgba(212,146,46,0.45)"; ctx.fill(); ctx.strokeStyle = "rgba(212,146,46,0.9)"; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(CTR, CTR); ctx.arc(CTR, CTR, eR - 4, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); ctx.closePath();
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
      ctx.beginPath(); ctx.moveTo(CTR, CTR); ctx.arc(CTR, CTR, rad, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); ctx.closePath();
      ctx.fillStyle = isEpic ? "rgba(212,146,46,0.35)" : "rgba(46,111,126,0.35)"; ctx.fill();
      ctx.strokeStyle = isEpic ? "rgba(212,146,46,0.8)" : "rgba(46,111,126,0.8)"; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  }, []);

  useEffect(() => { drawPie(); }, [userSegs, userArc, epicSegs, epicArc, epicEnabled, drawPie]);

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
        else { setUserSegs(newSegs); setUserArc(arc); }
      }
    }
    sweepRef.current = { active: false, s: null, c: null }; drawPie();
  }
  const finishSweepRef = useRef(finishSweep);
  finishSweepRef.current = finishSweep;

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!sweepRef.current.active) return;
      if ("touches" in e) e.preventDefault();
      const canvas = canvasRef.current; if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const raw = "touches" in e ? e.touches[0] : e; if (!raw) return;
      const cx = raw.clientX - r.left - CTR, cy = raw.clientY - r.top - CTR;
      if (Math.sqrt(cx * cx + cy * cy) < IR) return;
      let a = Math.atan2(cy, cx) * 180 / Math.PI + 90; if (a < 0) a += 360;
      sweepRef.current.c = a; drawPie();
    };
    const onUp = () => { if (sweepRef.current.active) finishSweepRef.current(); };
    document.addEventListener("mousemove", onMove); document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp); document.addEventListener("touchend", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("touchmove", onMove); document.removeEventListener("mouseup", onUp); document.removeEventListener("touchend", onUp); };
  }, [drawPie]);

  function onCanvasDown(e: React.MouseEvent | React.TouchEvent) {
    if (mode !== "select" || !pinPlaced) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const raw = "nativeEvent" in e ? ("touches" in e.nativeEvent ? (e.nativeEvent as TouchEvent).touches[0] : e.nativeEvent as MouseEvent) : null;
    if (!raw) return;
    const cx = raw.clientX - r.left - CTR, cy = raw.clientY - r.top - CTR;
    if (Math.sqrt(cx * cx + cy * cy) < IR) return;
    let a = Math.atan2(cy, cx) * 180 / Math.PI + 90; if (a < 0) a += 360;
    sweepRef.current = { active: true, s: a, c: a };
    e.preventDefault(); e.stopPropagation();
  }

  async function handleSave() {
    if (!user || !token) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Enter a name";
    if (!spotType) errs.type = "Choose a type";
    if (spotLat === null) errs.loc = "Click the map to choose a location";
    if (!userSegs.some(Boolean)) errs.dir = "Select at least 1 wind direction";
    if (epicEnabled && !epicSegs.some(Boolean)) errs.epic = "Select epic wind directions";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const dirs = DIRS.filter((_, i) => userSegs[i]);
      const eDirs = epicEnabled ? DIRS.filter((_, i) => epicSegs[i]) : null;
      const compassCenter = mapRef.current?.getCenter();

      const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          name: name.trim(), display_name: name.trim(), region: "Own spot", spot_type: spotType,
          level, latitude: spotLat, longitude: spotLng, good_directions: dirs,
          min_wind: wMin, max_wind: wMax, tips: tips.trim() || null,
          is_private: true, created_by: user.id, active: true,
        }),
      });
      if (!spotRes.ok) throw new Error(`spot_create_${spotRes.status}`);
      const newSpot = await spotRes.json();
      if (!newSpot?.length) throw new Error("spot_create_failed");
      const sid = newSpot[0].id;

      await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/user_spots`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: user.id, spot_id: sid }),
        }),
        fetch(`${SUPABASE_URL}/rest/v1/ideal_conditions`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            user_id: user.id, spot_id: sid, wind_min: wMin, wind_max: wMax,
            directions: dirs, enabled: true,
            perfect_enabled: epicEnabled,
            perfect_wind_min: epicEnabled ? eMin : null,
            perfect_wind_max: epicEnabled ? eMax : null,
            perfect_directions: eDirs,
            compass_lat: compassCenter?.lat ?? spotLat,
            compass_lng: compassCenter?.lng ?? spotLng,
          }),
        }),
      ]);

      const allSpotsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_spots?user_id=eq.${user.id}&select=spot_id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const allSpots = await allSpotsRes.json();
      if (allSpots?.length === 1) {
        setSavedSpotName(name.trim());
        setShowFirstSpotPopup(true);
        setSaving(false);
        return;
      }

      showToast("✓ Spot opgeslagen!");
      setTimeout(() => { window.location.href = "/mijn-spots"; }, 1200);
    } catch (e) {
      showToast("Opslaan mislukt: " + (e instanceof Error ? e.message : ""));
      setSaving(false);
    }
  }

  const userDirNames = DIRS.filter((_, i) => userSegs[i]);
  const epicDirNames = DIRS.filter((_, i) => epicSegs[i]);
  const labelR = CTR - 8;
  const labels = DIRS.map((d, i) => {
    const a = i * SEG_A; const r = (a - 90) * Math.PI / 180;
    return { d, x: CTR + Math.cos(r) * labelR, y: CTR + Math.sin(r) * labelR, isCard: i % 2 === 0 };
  });

  if (authLoading) return null;

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>

        <a href="/mijn-spots" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.sky, textDecoration: "none", marginBottom: 16 }}>
          {Icons.arrowLeft({ color: C.sky, size: 16 })} Terug naar mijn spots
        </a>
        <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 2, color: C.navy, margin: "0 0 4px" }}>Spot toevoegen</h1>
        <p style={{ fontSize: 14, color: C.sub, marginBottom: 24 }}>Voeg je eigen privé spot toe. Alleen jij kunt hem zien.</p>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Naam <span style={{ color: C.amber }}>*</span></label>
          <input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} maxLength={80} placeholder="Bijv. Mijn geheime spot"
            style={{ width: "100%", padding: "10px 14px", background: C.card, border: `1.5px solid ${errors.name ? C.amber : C.cardBorder}`, borderRadius: 10, fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
          {errors.name && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>{errors.name}</div>}
        </div>

        {/* Type */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Type <span style={{ color: C.amber }}>*</span></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TYPES.map((t) => (
              <button key={t.value} onClick={() => { setSpotType(t.value); setErrors((p) => ({ ...p, type: "" })); }} style={{ padding: "8px 18px", borderRadius: 10, border: `2px solid ${spotType === t.value ? C.sky : C.cardBorder}`, background: spotType === t.value ? `${C.sky}20` : C.card, fontSize: 13, fontWeight: 600, color: spotType === t.value ? C.sky : C.muted, cursor: "pointer" }}>{t.label}</button>
            ))}
          </div>
          {errors.type && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>{errors.type}</div>}
        </div>

        {/* Map + Compass */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Locatie & windrichtingen <span style={{ color: C.amber }}>*</span></label>
          <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 8 }}>
            {!pinPlaced ? "Klik op de kaart om je pin te plaatsen" : "Pin geplaatst! Schakel naar \"Wind selecteren\" en veeg over het kompas."}
          </p>
          <div style={{ position: "relative", width: "100%", height: "min(500px, 70vh)", borderRadius: 16, overflow: "hidden", border: `1px solid ${errors.loc || errors.dir ? C.amber : C.cardBorder}`, marginBottom: 8 }}>
            <div ref={mapElRef} style={{ width: "100%", height: "100%", zIndex: 1, cursor: mode === "map" && !pinPlaced ? "crosshair" : undefined }} />
            <button onClick={toggleMapLayer} style={{ position: "absolute", top: 12, right: 12, zIndex: 1001, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
              {isSat ? "Kaart" : "Satelliet"}
            </button>
            {pinPlaced && (
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1001, display: "flex", background: "rgba(0,0,0,0.6)", borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", overflow: "hidden", border: `1px solid rgba(255,255,255,0.15)`, gap: 2, padding: 2 }}>
                {(["map", "select"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: mode === m ? (m === "select" ? C.sky : "rgba(255,255,255,0.2)") : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: mode === m ? "#fff" : "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                    {m === "map" ? "📌 Kaart verplaatsen" : "🌊 Wind selecteren"}
                  </button>
                ))}
              </div>
            )}
            {pinPlaced && (
              <div style={{ position: "absolute", zIndex: 1000, width: SIZE, height: SIZE, left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: mode === "select" ? "auto" : "none" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, rgba(46,111,126,0.1), rgba(46,111,126,0.04))", border: `2px solid ${compassLayer === "epic" ? "rgba(212,146,46,0.6)" : "rgba(46,111,126,0.25)"}`, boxShadow: compassLayer === "epic" ? "0 0 0 3px rgba(212,146,46,0.12)" : "0 0 0 3px rgba(46,111,126,0.06)", pointerEvents: "none" }} />
                <canvas ref={canvasRef} width={SIZE} height={SIZE} onMouseDown={onCanvasDown} onTouchStart={onCanvasDown}
                  style={{ position: "absolute", inset: 0, borderRadius: "50%", zIndex: 2, cursor: mode === "select" ? "crosshair" : "default", touchAction: "none" }} />
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
                  <div key={l.d} style={{ position: "absolute", left: l.x, top: l.y, transform: "translate(-50%,-50%)", fontSize: l.isCard ? 12 : 9, fontWeight: 700, color: l.isCard ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", pointerEvents: "none", zIndex: 5 }}>{l.d}</div>
                ))}
                <div style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", fontSize: 12, whiteSpace: "nowrap", fontWeight: 700, padding: "8px 16px", borderRadius: 10, background: mode === "select" ? C.sky : C.card, color: mode === "select" ? "#fff" : C.navy, border: `1px solid ${C.cardBorder}`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                  {mode === "map" ? "Kaart verplaatsen om kompas te positioneren" : "Veeg over het water om richtingen te selecteren"}
                </div>
              </div>
            )}
          </div>
          {pinPlaced ? <div style={{ fontSize: 12, color: C.sub }}>📍 <strong style={{ color: C.sky }}>{spotLat!.toFixed(4)}, {spotLng!.toFixed(4)}</strong></div> : <div style={{ fontSize: 12, color: C.muted }}>Nog geen locatie gekozen — klik op de kaart</div>}
          {errors.loc && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>{errors.loc}</div>}
          {pinPlaced && (
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              {epicEnabled && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {(["good", "epic"] as const).map((l) => (
                    <button key={l} onClick={() => setCompassLayer(l)} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `2px solid ${compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.cardBorder}`, background: compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.card, fontSize: 13, fontWeight: 700, color: compassLayer === l ? "#fff" : C.muted, cursor: "pointer" }}>{l === "good" ? "Goed" : "Epic"}</button>
                  ))}
                </div>
              )}
              {userSegs.some(Boolean) && (
                <button onClick={() => { setUserSegs(new Array(16).fill(false)); setUserArc(null); }} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Selectie wissen</button>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10, minHeight: 24 }}>
            {userDirNames.length > 0
              ? userDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: `${C.sky}20`, color: C.sky }}>{d}</span>)
              : <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>{pinPlaced ? "Veeg over het kompas om richtingen te selecteren" : "Plaats eerst je pin"}</span>}
          </div>
          {errors.dir && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>{errors.dir}</div>}
        </div>

        {/* Wind range */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Ideale windsnelheid</label>
          <WindSlider min={wMin} max={wMax} onChange={(mn, mx) => { setWMin(mn); setWMax(mx); }} />
        </div>

        {/* Level */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Niveau</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setLevel(l)} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${level === l ? C.sky : C.cardBorder}`, background: level === l ? `${C.sky}20` : C.card, fontSize: 13, fontWeight: 500, color: level === l ? C.sky : C.muted, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "block" }}>Tips / notities</label>
          <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={3} placeholder="Bijv. Parkeren bij de boerderij, let op stroming bij vloed..."
            style={{ width: "100%", padding: "10px 14px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 14, color: C.navy, outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box" }} />
        </div>

        {/* Epic toggle */}
        <div onClick={() => { setEpicEnabled(!epicEnabled); if (!epicEnabled) setCompassLayer("epic"); else setCompassLayer("good"); }}
          style={{ background: epicEnabled ? C.epicBg : C.card, border: `2px solid ${epicEnabled ? "#E8A83E" : C.cardBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: epicEnabled ? "#E8A83E" : C.navy }}>🤙 Epic condities instellen</div>
            <div style={{ fontSize: 11, color: epicEnabled ? "#9A6830" : C.sub, fontStyle: "italic" }}>Krijg een speciale ping als de condities perfect zijn</div>
          </div>
          <div style={{ width: 48, height: 26, borderRadius: 13, background: epicEnabled ? "#E8A83E" : C.creamDark, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: epicEnabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.3s" }} />
          </div>
        </div>

        {epicEnabled && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#E8A83E", marginBottom: 4 }}>Epic windsnelheid</h2>
            <p style={{ fontSize: 12, color: "#9A6830", fontStyle: "italic", marginBottom: 12 }}>De perfecte windrange voor jouw sessie</p>
            <WindSlider min={eMin} max={eMax} onChange={(mn, mx) => { setEMin(mn); setEMax(mx); }} color="#E8A83E" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#E8A83E", marginTop: 20, marginBottom: 4 }}>Epic windrichtingen</h2>
            <p style={{ fontSize: 12, color: "#9A6830", fontStyle: "italic", marginBottom: 12 }}>Schakel naar "Epic" hierboven en veeg op het kompas</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
              {epicDirNames.length > 0
                ? epicDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#E8A83E", border: "1px solid rgba(245,158,11,0.4)" }}>{d}</span>)
                : <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Nog geen epic richtingen geselecteerd</span>}
            </div>
            {epicDirNames.length > 0 && (
              <button onClick={() => { setEpicSegs(new Array(16).fill(false)); setEpicArc(null); }} style={{ marginTop: 10, padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(245,158,11,0.4)", color: "#E8A83E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Epic selectie wissen</button>
            )}
            {errors.epic && <div style={{ color: C.amber, fontSize: 12, marginTop: 4 }}>{errors.epic}</div>}
          </div>
        )}

        {/* Save button */}
        <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, background: saving ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Opslaan..." : "Spot opslaan"}
        </button>

        {toast && (
          <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: toast.includes("✓") ? C.green : C.amber, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 10000 }}>{toast}</div>
        )}
      </div>

      {showFirstSpotPopup && (
        <FirstSpotPopup spotName={savedSpotName} onClose={() => { window.location.href = fromOnboarding ? "/" : "/mijn-spots"; }} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        .leaflet-control-attribution { background: transparent !important; font-size: 9px !important; opacity: 0.4 !important; }
      `}</style>
    </div>
  );
}