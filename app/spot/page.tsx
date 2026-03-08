"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
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

/* ── Supabase ── */
async function sbGet(path: string) {
  const token = await getValidToken(); if (!token) throw new Error("auth");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("auth"); if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json();
}
async function sbUpsert(table: string, data: any) {
  const token = await getValidToken(); if (!token) throw new Error("auth");
  // Atomic upsert via POST with merge-duplicates (requires UNIQUE constraint on user_id+spot_id)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error("auth");
  if (!res.ok) {
    // Fallback: try PATCH if POST upsert fails (e.g. no unique constraint)
    const patchUrl = `${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${data.user_id}&spot_id=eq.${data.spot_id}`;
    const patchRes = await fetch(patchUrl, { method: "PATCH", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(data) });
    if (!patchRes.ok) { const t = await patchRes.text(); throw new Error(`upsert_${patchRes.status}_${t}`); }
  }
}

/* ── Wind Range Slider (reusable) ── */
function WindSlider({ min, max, onChange, color = C.sky }: { min: number; max: number; onChange: (mn: number, mx: number) => void; color?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);
  // Keep onChange/min/max in refs to avoid stale closures in event listeners
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
  }, []); // mount once, read from refs
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

/* ── Main Spot Detail Content ── */
function SpotDetailContent() {
  const searchParams = useSearchParams();
  const spotId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spot, setSpot] = useState<any>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Conditions
  const [wMin, setWMin] = useState(15);
  const [wMax, setWMax] = useState(25);
  const [userSegs, setUserSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [userArc, setUserArc] = useState<[number, number] | null>(null); // [startAngle, endAngle] for smooth rendering
  const [defaults, setDefaults] = useState<boolean[]>(new Array(16).fill(false));
  const [isSaved, setIsSaved] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);

  // Epic
  const [epicEnabled, setEpicEnabled] = useState(false);
  const [eMin, setEMin] = useState(15);
  const [eMax, setEMax] = useState(30);
  const [epicSegs, setEpicSegs] = useState<boolean[]>(new Array(16).fill(false));
  const [epicArc, setEpicArc] = useState<[number, number] | null>(null);

  // Tide preferences (sea spots only)
  const [tideEnabled, setTideEnabled] = useState(false);
  const [tideRef, setTideRef] = useState<"HW" | "LW">("HW");
  const [tideBefore, setTideBefore] = useState(2);
  const [tideAfter, setTideAfter] = useState(1);

  // Map & compass
  const [mode, setMode] = useState<"select" | "map">("select");
  const [compassLayer, setCompassLayer] = useState<"good" | "epic">("good");
  const [compassLat, setCompassLat] = useState<number | null>(null);
  const [compassLng, setCompassLng] = useState<number | null>(null);
  const compassLatRef = useRef<number | null>(null);
  const compassLngRef = useRef<number | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [prikbordPosts, setPrikbordPosts] = useState<PrikbordPost[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "prikbord" | "voorkeuren">("info");

  // Refs
  const mapRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const LRef = useRef<any>(null);
  const sweepRef = useRef<{ active: boolean; s: number | null; c: number | null }>({ active: false, s: null, c: null });

  // Mutable refs for canvas drawing and auto-save (avoids stale closures)
  const stateRef = useRef({ userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter });
  useEffect(() => { stateRef.current = { userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter }; }, [userSegs, userArc, defaults, isSaved, epicSegs, epicArc, epicEnabled, compassLayer, hasEdits, wMin, wMax, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  /* ── Load spot data ── */
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

      // Wind
      if (existing?.wind_min != null) { setWMin(existing.wind_min); setWMax(existing.wind_max); }
      else if (user.min_wind_speed != null) { setWMin(user.min_wind_speed); setWMax(user.max_wind_speed || 25); }

      // Compass position
      if (existing?.compass_lat != null) { setCompassLat(existing.compass_lat); setCompassLng(existing.compass_lng); compassLatRef.current = existing.compass_lat; compassLngRef.current = existing.compass_lng; }

      // Directions
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

      // Epic
      if (existing?.perfect_enabled) {
        setEpicEnabled(true);
        if (existing.perfect_wind_min != null) { setEMin(existing.perfect_wind_min); setEMax(existing.perfect_wind_max || 30); }
        if (existing.perfect_directions?.length) {
          const eSegs = new Array(16).fill(false);
          DIRS.forEach((d, i) => { if (existing.perfect_directions.includes(d)) eSegs[i] = true; });
          setEpicSegs(eSegs);
        }
      }

      // Tide
      if (existing?.tide_enabled) {
        setTideEnabled(true);
        if (existing.tide_reference) setTideRef(existing.tide_reference);
        if (existing.tide_hours_before != null) setTideBefore(existing.tide_hours_before);
        if (existing.tide_hours_after != null) setTideAfter(existing.tide_hours_after);
      }

      if (existing) setIsSaved(true);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });

    // Laad prikbord posts (los van de main fetch)
    sbGet(`spot_posts?spot_id=eq.${spotId}&order=created_at.desc&limit=20&select=id,type,content,author_name,created_at,wind_speed,wind_dir`)
      .then(posts => setPrikbordPosts(posts || []))
      .catch(() => {});
  }, [spotId]);

  /* ── Load Leaflet ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!document.querySelector('link[href*="leaflet"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l); }
    if (!(window as any).L) { const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => { LRef.current = (window as any).L; }; document.head.appendChild(s); }
    else LRef.current = (window as any).L;
  }, []);

  /* ── Init map when spot loads ── */
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
      satLayerRef.current = sat;
      streetLayerRef.current = street;
      const col = typeColors[spot.spot_type] || C.sky;
      if (spot.latitude && spot.longitude) {
        spotMarkerRef.current = L.circleMarker([spot.latitude, spot.longitude], { radius: 8, color: col, fillColor: col, fillOpacity: 0.8, weight: 2 }).addTo(map);
      }
      // When map is moved (in "Position compass" mode), move marker to center
      map.on("moveend", () => {
        if (!spotMarkerRef.current) return;
        const c = map.getCenter();
        spotMarkerRef.current.setLatLng([c.lat, c.lng]);
      });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    };
    tryInit();
    // Cleanup on unmount
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [spot, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMapLayer() {
    if (!mapRef.current || !satLayerRef.current || !streetLayerRef.current) return;
    const map = mapRef.current;
    if (isSat) { map.removeLayer(satLayerRef.current); streetLayerRef.current.addTo(map); }
    else { map.removeLayer(streetLayerRef.current); satLayerRef.current.addTo(map); }
    setIsSat(!isSat);
  }

  /* ── Mode toggle (map drag vs compass select) ── */
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (mode === "map") { map.dragging.enable(); map.touchZoom.enable(); map.scrollWheelZoom.enable(); }
    else { map.dragging.disable(); map.touchZoom.disable(); map.scrollWheelZoom.disable(); }
  }, [mode]);

  /* ── Convert segments array to smooth arc angles ── */
  function segsToArc(segs: boolean[]): [number, number] | null {
    const active: number[] = [];
    for (let i = 0; i < SEG; i++) if (segs[i]) active.push(i);
    if (!active.length) return null;
    // Find contiguous run (may wrap around 0)
    let start = active[0], end = active[active.length - 1];
    // Check if it wraps around (e.g. [14,15,0,1])
    let contiguous = true;
    for (let j = 1; j < active.length; j++) {
      if (active[j] !== active[j - 1] + 1) { contiguous = false; break; }
    }
    if (!contiguous) {
      // Try wrap-around: find the gap
      const all = new Set(active);
      let gapStart = -1;
      for (let i = 0; i < SEG; i++) {
        if (!all.has(i) && all.has((i + SEG - 1) % SEG)) { gapStart = i; break; }
      }
      if (gapStart >= 0) {
        // Walk from gapStart to find start and end
        let s = gapStart;
        while (!all.has(s)) s = (s + 1) % SEG;
        start = s;
        let e = (gapStart + SEG - 1) % SEG;
        end = e;
      }
    }
    const fromAngle = start * SEG_A - SEG_A / 2;
    const toAngle = end * SEG_A + SEG_A / 2;
    return [fromAngle, toAngle];
  }

  /* ── Draw compass ── */
  const drawPie = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const st = stateRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);

    const hasUserSelection = st.userSegs.some(Boolean);

    // Defaults (subtle hint) — only show if user hasn't selected anything
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

    // User selection (solid teal arc — high opacity)
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

    // Epic selection (gold arc, smaller radius, double border for distinction)
    if (st.epicEnabled && st.epicSegs.some(Boolean)) {
      const arc = st.epicArc || segsToArc(st.epicSegs);
      if (arc) {
        const [from, to] = arc;
        const eR = OR * 0.72;
        // Fill
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, eR, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.fillStyle = "rgba(212,146,46,0.45)"; ctx.fill();
        // Outer border (thick)
        ctx.strokeStyle = "rgba(212,146,46,0.9)"; ctx.lineWidth = 3; ctx.stroke();
        // Inner highlight border (white, for double-border effect)
        ctx.beginPath(); ctx.moveTo(CTR, CTR);
        ctx.arc(CTR, CTR, eR - 4, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // Sweep preview (live dragging)
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

  /* ── Sweep handlers ── */
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
        // Calculate smooth arc from sweep
        let s = normA(sw.s), e = normA(sw.c), diff = e - s;
        if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
        let from: number, to: number;
        if (diff >= 0) { from = s; to = s + diff; } else { from = s + diff; to = s; }
        const arc: [number, number] = [from, to];

        if (stateRef.current.compassLayer === "epic") {
          setEpicSegs(newSegs);
          setEpicArc(arc);
        } else {
          setUserSegs(newSegs);
          setUserArc(arc);
          setHasEdits(true);
          setIsSaved(false);
        }
      }
    }
    sweepRef.current = { active: false, s: null, c: null };
    drawPie();
  }

  // Store finishSweep in a ref so event listeners always call the latest version
  const finishSweepRef = useRef(finishSweep);
  finishSweepRef.current = finishSweep;

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!sweepRef.current.active) return;
      if ("touches" in e) e.preventDefault(); // Prevent page scroll during sweep
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
  }, [drawPie]); // stable dependency — drawPie uses useCallback with no deps

  function onCanvasDown(e: React.MouseEvent | React.TouchEvent) {
    if (mode !== "select") return;
    const a = angleFromEvent(e.nativeEvent); if (a === null) return;
    sweepRef.current = { active: true, s: a, c: a };
    e.preventDefault(); e.stopPropagation();
  }

  /* ── Save ── */
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
    } catch (e: any) {
      if (showFeedback) showToast("Save failed");
    }
  }

  async function handleSave() {
    if (!spot || !userId) return;
    if (epicEnabled && !epicSegs.some(Boolean)) { showToast("Select epic wind directions first"); return; }
    setSaving(true);
    await doSave(true);
    setSaving(false);
  }

  // Auto-save after first manual save — debounce 1200ms
  useEffect(() => {
    if (!isSaved || !userId || !spot) return; // Only auto-save after first save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { doSave(true); }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [wMin, wMax, userSegs, epicSegs, epicEnabled, eMin, eMax, tideEnabled, tideRef, tideBefore, tideAfter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Direction tags ── */
  const userDirNames = DIRS.filter((_, i) => userSegs[i]);
  const defaultDirNames = !isSaved ? DIRS.filter((_, i) => defaults[i] && !userSegs[i]) : [];
  const epicDirNames = DIRS.filter((_, i) => epicSegs[i]);

  /* ── Compass label positions ── */
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

  const TABS: { key: "info" | "prikbord" | "voorkeuren"; label: string; emoji: string }[] = [
    { key: "info", label: "Spot info", emoji: "📍" },
    { key: "prikbord", label: "Prikbord", emoji: "📌" },
    { key: "voorkeuren", label: "Voorkeuren", emoji: "⚙️" },
  ];

  return (
    <>
      {/* Back + Header */}
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
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 9, border: "none",
            background: activeTab === tab.key ? "#FFFFFF" : "transparent",
            color: activeTab === tab.key ? C.navy : "#8A7A6A",
            fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            boxShadow: activeTab === tab.key ? "0 1px 6px rgba(0,0,0,0.10)" : "none",
            transition: "all 0.15s ease",
          }}>
            <span style={{ fontSize: 13 }}>{tab.emoji}</span>
            {tab.label}
            {tab.key === "prikbord" && prikbordPosts.length > 0 && (
              <span style={{ background: C.sky, color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                {prikbordPosts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Info ── */}
      {activeTab === "info" && (
        <>
          {/* Tips */}
          {(spot.tips || spot.good_directions?.length > 0) && (
            <div style={{ background: C.card, borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: C.sub, lineHeight: 1.5, boxShadow: C.cardShadow }}>
              {spot.tips && <div style={{ marginBottom: 8 }}>{spot.tips}</div>}
              {spot.good_directions?.length > 0 && <div style={{ fontWeight: 600, color: C.navy }}>Recommended: {spot.good_directions.join(", ")}</div>}
            </div>
          )}

          {/* Map + Compass */}
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

          {/* Quick compass layer tabs under map (only when epic enabled) */}
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

          {/* Go to voorkeuren CTA */}
          <button onClick={() => setActiveTab("voorkeuren")} style={{ width: "100%", marginTop: 8, padding: "12px 16px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: C.sky, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: C.cardShadow }}>
            ⚙️ Stel jouw windvoorkeuren in →
          </button>
        </>
      )}

      {/* ── TAB: Prikbord ── */}
      {activeTab === "prikbord" && spot && (
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
      {activeTab === "voorkeuren" && (
        <>
          {/* Compass layer switcher (if epic) */}
          {epicEnabled && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["good", "epic"] as const).map((l) => (
                <button key={l} onClick={() => setCompassLayer(l)} style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `2px solid ${compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.cardBorder}`, background: compassLayer === l ? (l === "good" ? C.sky : C.gold) : C.card, fontSize: 13, fontWeight: 700, color: compassLayer === l ? "#fff" : C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: compassLayer === l ? "#fff" : (l === "good" ? C.sky : C.gold) }} />
                  {l === "good" ? "Good" : "Epic"}
                </button>
              ))}
            </div>
          )}

          {/* Direction section */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Wind Directions</h2>
            <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 12 }}>You'll only get pinged when wind comes from these directions</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
              {userDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: `${C.sky}20`, color: C.sky, border: `1px solid ${C.sky}40` }}>{d}</span>)}
              {defaultDirNames.map((d) => <span key={d} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: C.creamDark, color: C.muted, border: `1px solid ${C.cardBorder}` }}>{d}</span>)}
              {!userDirNames.length && !defaultDirNames.length && <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Sweep over water on the compass on the Info tab</span>}
            </div>
            {hasEdits && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setUserSegs(new Array(16).fill(false)); setUserArc(null); setHasEdits(false); setIsSaved(false); }} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.cardBorder}`, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset to default</button>
                <button onClick={() => { setUserSegs(new Array(16).fill(false)); setUserArc(null); setHasEdits(false); }} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.amber}40`, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear selection</button>
              </div>
            )}
          </div>

          {/* Wind range */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Wind Speed Range</h2>
            <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 12 }}>You'll only get pinged when wind speed falls within this range</p>
            <WindSlider min={wMin} max={wMax} onChange={(mn, mx) => { setWMin(mn); setWMax(mx); }} />
          </div>

          {/* Epic toggle */}
          <div onClick={() => { const next = !epicEnabled; setEpicEnabled(next); if (next) setCompassLayer("epic"); else setCompassLayer("good"); }} style={{ background: epicEnabled ? C.epicBg : C.card, border: `2px solid ${epicEnabled ? "#E8A83E" : C.cardBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: epicEnabled ? "#E8A83E" : C.navy, display: "flex", alignItems: "center", gap: 6 }}>🤙 Set Epic conditions</div>
              <div style={{ fontSize: 11, color: epicEnabled ? "#9A6830" : C.sub, fontStyle: "italic" }}>Get a special ping when conditions are perfect</div>
            </div>
            <div style={{ width: 48, height: 26, borderRadius: 13, background: epicEnabled ? "#E8A83E" : C.creamDark, position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: epicEnabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.3s" }} />
            </div>
          </div>

          {/* Epic content */}
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

          {/* Tide preferences (sea spots only) */}
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

          {/* Save button */}
          <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : isSaved ? "Update preferences" : "Add to my spots"}
          </button>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: toast.includes("✓") ? C.green : C.amber, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10000 }}>{toast}</div>
      )}
    </>
  );
}

/* ── Page wrapper ── */
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