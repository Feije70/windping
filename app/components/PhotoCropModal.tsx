"use client";
/* ── app/components/PhotoCropModal.tsx ────────────────────────
   Crop modal: sleep om te kiezen welk deel zichtbaar is.
   Geeft een CSS objectPosition string terug: "50% 30%"

   Usage:
     <PhotoCropModal
       imageUrl={url}
       onConfirm={(position) => saveCrop(position)}
       onCancel={() => setShowCrop(false)}
     />
   ──────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  imageUrl: string;
  initialPosition?: string; // "50% 50%"
  onConfirm: (position: string) => void;
  onCancel: () => void;
}

// Parse "50% 30%" → { x: 50, y: 30 }
function parsePosition(pos: string): { x: number; y: number } {
  const parts = pos.replace(/%/g, "").trim().split(/\s+/);
  return { x: parseFloat(parts[0] ?? "50"), y: parseFloat(parts[1] ?? "50") };
}

export default function PhotoCropModal({ imageUrl, initialPosition = "50% 50%", onConfirm, onCancel }: Props) {
  const [pos, setPos] = useState(parsePosition(initialPosition));
  const dragging = useRef(false);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Compute new position from a drag delta (in pixels)
  const applyDelta = useCallback((dx: number, dy: number) => {
    if (!containerRef.current || !imgRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = imgRef.current.naturalWidth;
    const ih = imgRef.current.naturalHeight;

    // How many percent does 1px of drag translate to?
    // We need to think in "image space" — how far can we pan?
    // The visible range depends on how much larger the image is than the container
    const scaleX = cw / iw;
    const scaleY = ch / ih;
    const scale = Math.max(scaleX, scaleY); // objectFit: cover scale

    const renderedW = iw * scale;
    const renderedH = ih * scale;

    const excessW = renderedW - cw;
    const excessH = renderedH - ch;

    // If no excess (image fits perfectly), no panning possible
    const pxPerPercentX = excessW > 0 ? excessW / 100 : 1;
    const pxPerPercentY = excessH > 0 ? excessH / 100 : 1;

    // Dragging right → image moves right → anchor point moves left (lower %)
    setPos(prev => ({
      x: Math.max(0, Math.min(100, prev.x - dx / pxPerPercentX)),
      y: Math.max(0, Math.min(100, prev.y - dy / pxPerPercentY)),
    }));
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      applyDelta(e.movementX, e.movementY);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [applyDelta]);

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!lastTouch.current) return;
    const dx = e.touches[0].clientX - lastTouch.current.x;
    const dy = e.touches[0].clientY - lastTouch.current.y;
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    applyDelta(dx, dy);
  };
  const onTouchEnd = () => { lastTouch.current = null; };

  const posString = `${Math.round(pos.x)}% ${Math.round(pos.y)}%`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10, 20, 35, 0.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      {/* Header */}
      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
        Stel foto bij
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 20, textAlign: "center" }}>
        Sleep om te bepalen wat zichtbaar is
      </div>

      {/* Crop frame — 4:3 */}
      <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
        {/* Guide lines overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "33.33% 33.33%",
          borderRadius: 12,
        }} />

        {/* Crop container */}
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            width: "100%",
            aspectRatio: "4/3",
            overflow: "hidden",
            borderRadius: 12,
            cursor: "grab",
            border: "2px solid rgba(255,255,255,0.3)",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: posString,
              display: "block",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          />
        </div>

        {/* Corner indicators */}
        {["0 0", "100% 0", "0 100%", "100% 100%"].map((corner, i) => (
          <div key={i} style={{
            position: "absolute",
            top: i < 2 ? -1 : "auto",
            bottom: i >= 2 ? -1 : "auto",
            left: i % 2 === 0 ? -1 : "auto",
            right: i % 2 === 1 ? -1 : "auto",
            width: 16, height: 16,
            borderTop: i < 2 ? "3px solid #fff" : "none",
            borderBottom: i >= 2 ? "3px solid #fff" : "none",
            borderLeft: i % 2 === 0 ? "3px solid #fff" : "none",
            borderRight: i % 2 === 1 ? "3px solid #fff" : "none",
            borderRadius: i === 0 ? "4px 0 0 0" : i === 1 ? "0 4px 0 0" : i === 2 ? "0 0 0 4px" : "0 0 4px 0",
          }} />
        ))}
      </div>

      {/* Position hint */}
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 12, fontVariantNumeric: "tabular-nums" }}>
        {posString}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, width: "100%", maxWidth: 400 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          }}
        >
          Annuleer
        </button>
        <button
          onClick={() => onConfirm(posString)}
          style={{
            flex: 2, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #2E8B8F, #1a6b6f)",
            color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(46,139,143,0.4)",
          }}
        >
          ✓ Opslaan
        </button>
      </div>
    </div>
  );
}