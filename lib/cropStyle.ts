import type { CSSProperties } from "react";

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

export function cropStyle(raw: string | null | undefined): CSSProperties {
  const { x, y, scale } = parseCrop(raw);
  return {
    display: "block", width: "100%", height: "100%",
    objectFit: "cover" as const,
    objectPosition: `${x}% ${y}%`,
    ...(scale > 1 ? { transform: `scale(${scale})`, transformOrigin: `${x}% ${y}%` } : {}),
  };
}
