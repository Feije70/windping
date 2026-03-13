"use client";
import { useState } from "react";
import { C } from "../lib/constants";

export function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none",
        cursor: "pointer", padding: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.sky, textAlign: "left",
      }}>
        <span style={{ fontSize: 12, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: 16, ...style }}>
      {children}
    </div>
  );
}

export function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.sky }}>{value}</div>
      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

export function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ width: 16, height: 16, borderRadius: "50%", background: C.creamDark, border: `1px solid ${C.cardBorder}`, fontSize: 10, fontWeight: 700, color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help", flexShrink: 0 }}
      >?</span>
      {show && (
        <span style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", background: C.navy, color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 8, zIndex: 100, maxWidth: 260, whiteSpace: "normal" as const, lineHeight: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {text}
        </span>
      )}
    </span>
  );
}
