"use client";
/* ── app/components/PhotoCropModal.tsx ──
   Pan + pinch/scroll zoom crop modal.
   Slaat op als JSON: '{"x":50,"y":40,"scale":1.8}'
   Backwards compat: bestaande "50% 50%" strings werken nog.
   Exporteert ook cropStyle() helper voor alle foto displays.
*/

import { useCallback, useEffect, useRef, useState } from "react";

export interface CropState { x: number; y: number; scale: number; }

export function parseCrop(raw: string | null | undefined): CropState {
  if (!raw) return { x: 50, y: 50, scale: 1 };
  if (raw.startsWith("{")) {
    try { const p = JSON.parse(raw); return { x: p.x ?? 50, y: p.y ?? 50, scale: p.scale ?? 1 }; }
    catch { return { x: 50, y: 50, scale: 1 }; }
  }
  const parts = raw.replace(/%/g, "").trim().split(/\s+/);
  return { x: parseFloat(parts[0] ?? "50"), y: parseFloat(parts[1] ?? "50"), scale: 1 };
}

export function cropStyle(raw: string | null | undefined): React.CSSProperties {
  const { x, y, scale } = parseCrop(raw);
  return {
    display: "block", width: "100%", height: "100%",
    objectFit: "cover" as const,
    objectPosition: `${x}% ${y}%`,
    ...(scale > 1 ? { transform: `scale(${scale})`, transformOrigin: `${x}% ${y}%` } : {}),
  };
}

interface Props {
  imageUrl: string;
  initialPosition?: string;
  onConfirm: (cropString: string) => void;
  onCancel: () => void;
}

const MIN_SCALE = 1, MAX_SCALE = 4;
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

export default function PhotoCropModal({ imageUrl, initialPosition, onConfirm, onCancel }: Props) {
  const initial = parseCrop(initialPosition);
  const [crop, setCrop] = useState<CropState>(initial);
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const lastTouches = useRef<{ x: number; y: number }[]>([]);
  const lastPinchDist = useRef<number | null>(null);

  const applyPan = useCallback((dxPx: number, dyPx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { scale } = cropRef.current;
    const pctPerPxX = 100 / (el.clientWidth * scale);
    const pctPerPxY = 100 / (el.clientHeight * scale);
    setCrop(prev => ({
      ...prev,
      x: clamp(prev.x - dxPx * pctPerPxX, 0, 100),
      y: clamp(prev.y - dyPx * pctPerPxY, 0, 100),
    }));
  }, []);

  const applyZoom = useCallback((factor: number) => {
    setCrop(prev => ({ ...prev, scale: clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE) }));
  }, []);

  // Mouse
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !lastMouse.current) return;
      applyPan(e.clientX - lastMouse.current.x, e.clientY - lastMouse.current.y);
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [applyPan]);

  // Scroll zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); applyZoom(e.deltaY < 0 ? 1.1 : 0.9); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouches.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    lastPinchDist.current = e.touches.length === 2
      ? Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    if (e.touches.length === 2 && lastPinchDist.current !== null && lastTouches.current.length === 2) {
      const dist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
      applyZoom(dist / lastPinchDist.current);
      lastPinchDist.current = dist;
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      const prevMidX = (lastTouches.current[0].x + lastTouches.current[1].x) / 2;
      const prevMidY = (lastTouches.current[0].y + lastTouches.current[1].y) / 2;
      applyPan(midX - prevMidX, midY - prevMidY);
    } else if (e.touches.length === 1 && lastTouches.current.length >= 1) {
      applyPan(touches[0].x - lastTouches.current[0].x, touches[0].y - lastTouches.current[0].y);
    }
    lastTouches.current = touches;
  };
  const onTouchEnd = () => { lastTouches.current = []; lastPinchDist.current = null; };

  const { x, y, scale } = crop;
  const cropString = JSON.stringify({ x: Math.round(x), y: Math.round(y), scale: Math.round(scale * 100) / 100 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,20,35,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 20px" }}>
      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>Foto bijsnijden</div>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 16, textAlign: "center" }}>Sleep · Knijp of scroll om in te zoomen</div>

      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)`, backgroundSize: "33.33% 33.33%", borderRadius: 12 }} />
        {/* Container */}
        <div ref={containerRef} onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", borderRadius: 12, cursor: "grab", border: "2px solid rgba(255,255,255,0.25)", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }}>
          <img src={imageUrl} alt="" draggable={false} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: `${Math.round(x)}% ${Math.round(y)}%`, transform: scale > 1 ? `scale(${scale})` : undefined, transformOrigin: `${Math.round(x)}% ${Math.round(y)}%`, userSelect: "none", WebkitUserSelect: "none" }} />
        </div>
        {/* Corner brackets */}
        {[0,1,2,3].map(i => (
          <div key={i} style={{ position: "absolute", top: i < 2 ? -2 : "auto", bottom: i >= 2 ? -2 : "auto", left: i%2===0 ? -2 : "auto", right: i%2===1 ? -2 : "auto", width: 18, height: 18, borderTop: i<2 ? "3px solid #fff" : "none", borderBottom: i>=2 ? "3px solid #fff" : "none", borderLeft: i%2===0 ? "3px solid #fff" : "none", borderRight: i%2===1 ? "3px solid #fff" : "none", borderRadius: i===0?"4px 0 0 0":i===1?"0 4px 0 0":i===2?"0 0 0 4px":"0 0 4px 0" }} />
        ))}
      </div>

      {/* Zoom controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={() => applyZoom(1/1.25)} style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer" }}>−</button>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, minWidth: 48, textAlign: "center" }}>{Math.round(scale * 100)}%</div>
        <button onClick={() => applyZoom(1.25)} style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer" }}>+</button>
        <button onClick={() => setCrop({ x: 50, y: 50, scale: 1 })} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer" }}>Reset</button>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, width: "100%", maxWidth: 420 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>Annuleer</button>
        <button onClick={() => { console.log("crop clicked", JSON.stringify(crop)); onConfirm(JSON.stringify(crop)); }} style={{ flex: 2, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #2E8FAE, #1a6b8a)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(46,143,174,0.4)" }}>✓ Opslaan</button>
      </div>
    </div>
  );
}