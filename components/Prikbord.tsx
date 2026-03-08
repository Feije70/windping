"use client";

import { useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY, getValidToken } from "@/lib/supabase";

export type PostType = "go" | "report" | "tip" | "warning" | "question";

export interface PrikbordPost {
  id: number;
  type: PostType;
  content: string;
  author_name: string;
  created_at: string;
  wind_speed?: number;
  wind_dir?: string;
  isPlaceholder?: boolean;
}

const T: Record<PostType, { label: string; emoji: string; color: string; bg: string; border: string; pin: string }> = {
  go:       { label: "Ik ga!",   emoji: "🤙", color: "#1E7A56", bg: "#D6F5E8", border: "#A8E4CA", pin: "#1E7A56" },
  report:   { label: "Rapport",  emoji: "🌊", color: "#1A6080", bg: "#D6EEF8", border: "#A0D4EE", pin: "#1A6080" },
  tip:      { label: "Tip",      emoji: "📌", color: "#8A5C00", bg: "#FEF3CC", border: "#F0D878", pin: "#D4A000" },
  warning:  { label: "Let op",   emoji: "⚠️", color: "#B02000", bg: "#FDE8E2", border: "#F4AE9A", pin: "#B02000" },
  question: { label: "Vraag",    emoji: "❓", color: "#5A3888", bg: "#EDE6F8", border: "#C8B0E8", pin: "#5A3888" },
};

const PLACEHOLDERS: PrikbordPost[] = [
  { id: -1, type: "tip",      content: "Skeg gevonden op het strand, afgegeven bij de surfschool.", author_name: "Marieke",    created_at: new Date(Date.now() - 2*3600000).toISOString(),   isPlaceholder: true },
  { id: -2, type: "warning",  content: "Parkeerplaats noord afgesloten t/m 12 maart i.v.m. wegwerkzaamheden.", author_name: "SpotBeheer", created_at: new Date(Date.now() - 26*3600000).toISOString(), isPlaceholder: true },
  { id: -3, type: "go",       content: "Morgenochtend 10u bij de uitrit noord. Wie mee?",           author_name: "Feije",      created_at: new Date(Date.now() - 3*3600000).toISOString(),   isPlaceholder: true },
  { id: -4, type: "report",   content: "Windstil dit weekend helaas. Volgende week beter.",         author_name: "Tsjerk",     created_at: new Date(Date.now() - 5*3600000).toISOString(),   isPlaceholder: true },
  { id: -5, type: "question", content: "BBQ bij paal 8 vanavond? Wie doet mee?",                   author_name: "Sanne",      created_at: new Date(Date.now() - 6*3600000).toISOString(),   isPlaceholder: true },
];

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m/60)}u`;
  return `${Math.floor(m/1440)}d`;
}

function Pin({ color }: { color: string }) {
  return (
    <svg width="16" height="22" viewBox="0 0 16 22" fill="none" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 3, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
      <circle cx="8" cy="7" r="6" fill={color} />
      <circle cx="6" cy="5" r="2" fill="rgba(255,255,255,0.35)" />
      <line x1="8" y1="13" x2="8" y2="22" stroke="#9B8B7A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PostCard({ post, compact }: { post: PrikbordPost; compact: boolean }) {
  const t = T[post.type];
  const ph = post.isPlaceholder;

  return (
    <div style={{
      position: "relative",
      background: t.bg,
      border: `1.5px solid ${t.border}`,
      borderRadius: 10,
      padding: compact ? "16px 12px 11px" : "18px 14px 12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      opacity: ph ? 0.72 : 1,
      transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s",
      cursor: ph ? "default" : "pointer",
      minHeight: compact ? 88 : 105,
    }}
      onMouseEnter={e => { if (!ph) { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.14)"; } }}
      onMouseLeave={e => { if (!ph) { const el = e.currentTarget as HTMLElement; el.style.transform = ""; el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; } }}
    >
      <Pin color={t.pin} />

      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{t.emoji}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" as const, color: t.color, fontFamily: "system-ui" }}>
          {t.label}
        </span>
        {post.wind_speed && !ph && (
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: t.color, fontFamily: "system-ui" }}>{post.wind_speed}kn {post.wind_dir}</span>
        )}
      </div>

      {/* Content */}
      <p style={{ margin: "0 0 9px", fontSize: compact ? 12 : 13, lineHeight: 1.45, color: "#2A1F14", fontFamily: "'Georgia', serif" }}>
        {post.content}
      </p>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.color, fontFamily: "system-ui" }}>{post.author_name}</span>
        <span style={{ fontSize: 10, color: "#9B8878", fontFamily: "system-ui" }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

function PostModal({ spotId, userId, userName, onClose, onPosted }: {
  spotId: number; userId: number; userName: string;
  onClose: () => void; onPosted: (p: PrikbordPost) => void;
}) {
  const [type, setType] = useState<PostType>("report");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = T[type];

  const placeholders: Record<PostType, string> = {
    go:       "Bijv: Morgen 10u bij de uitrit. Wie mee?",
    report:   "Bijv: 19kn NW, strand breed, weinig mensen.",
    tip:      "Bijv: Bij laagwater uitkijken voor stenen links van de vlaggen.",
    warning:  "Bijv: Parkeerplaats noord afgesloten t/m 12 maart.",
    question: "Bijv: Kent iemand een goeie foilrepair in de buurt?",
  };

  async function submit() {
    if (!content.trim()) { setError("Schrijf eerst iets."); return; }
    setSaving(true); setError("");
    try {
      const token = await getValidToken();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_posts`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ spot_id: spotId, user_id: userId, author_name: userName, type, content: content.trim() }),
      });
      if (!res.ok) throw new Error();
      const [p] = await res.json();
      onPosted(p); onClose();
    } catch { setError("Kon niet opslaan. Probeer opnieuw."); }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#FBF7F0", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", width: "100%", maxWidth: 480, boxShadow: "0 -4px 30px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 32, height: 4, background: "#D8CECC", borderRadius: 2, margin: "0 auto 18px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#2A1F14", marginBottom: 14, fontFamily: "system-ui" }}>📌 Prik iets op het bord</div>
        <div style={{ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto" as const, paddingBottom: 2 }}>
          {(Object.entries(T) as [PostType, typeof T[PostType]][]).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)} style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: `1.5px solid ${type === k ? v.color : "#E0D4C8"}`,
              background: type === k ? v.bg : "white",
              color: type === k ? v.color : "#9B8878",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "system-ui",
            }}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={placeholders[type]} rows={4}
          style={{ width: "100%", borderRadius: 12, border: `1.5px solid ${t.border}`, background: t.bg, padding: "12px 14px", fontSize: 14, color: "#2A1F14", fontFamily: "'Georgia', serif", resize: "none" as const, outline: "none", lineHeight: 1.5, boxSizing: "border-box" as const }}
          autoFocus
        />
        {error && <div style={{ fontSize: 12, color: "#B02000", marginTop: 5, fontFamily: "system-ui" }}>{error}</div>}
        <button onClick={submit} disabled={saving || !content.trim()} style={{
          marginTop: 12, width: "100%", padding: 14, borderRadius: 14,
          background: !content.trim() ? "#E8E0D8" : t.color,
          color: !content.trim() ? "#B0A898" : "white",
          fontSize: 14, fontWeight: 800, border: "none", cursor: !content.trim() ? "default" : "pointer", fontFamily: "system-ui",
        }}>
          {saving ? "Wordt gepind..." : "📌 Prik op het bord"}
        </button>
      </div>
    </div>
  );
}

interface PrikbordProps {
  spotId: number;
  spotName: string;
  userId: number | null;
  userName: string;
  posts: PrikbordPost[];
  onPostAdded?: (p: PrikbordPost) => void;
  compact?: boolean;
  showAll?: boolean;
}

export default function Prikbord({ spotId, spotName, userId, userName, posts, onPostAdded, compact = false, showAll = false }: PrikbordProps) {
  const [showModal, setShowModal] = useState(false);
  const [localPosts, setLocalPosts] = useState<PrikbordPost[]>(posts);

  const hasReal = localPosts.length > 0;
  const display = hasReal ? localPosts : PLACEHOLDERS;
  const visible = compact ? display.slice(0, 4) : display;
  const extra = hasReal && !showAll && display.length > 4 ? display.length - 4 : 0;

  function handlePosted(p: PrikbordPost) {
    setLocalPosts(prev => [p, ...prev]);
    onPostAdded?.(p);
  }

  return (
    <>
      <div style={{ background: "#EDE3D4", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", border: "1px solid #D8CEC0", overflow: "visible" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 24px", marginTop: -10, position: "relative" as const, zIndex: 1 }}>
          <div style={{ width: 10, height: 18, background: "linear-gradient(180deg,#C8A878,#A88850)", borderRadius: "3px 3px 0 0", boxShadow: "1px 0 3px rgba(0,0,0,0.2)" }} />
          <div style={{ width: 10, height: 18, background: "linear-gradient(180deg,#C8A878,#A88850)", borderRadius: "3px 3px 0 0", boxShadow: "1px 0 3px rgba(0,0,0,0.2)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 8px", borderBottom: "1px solid #D0C4B0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: "#7A5C38", textTransform: "uppercase" as const, fontFamily: "system-ui" }}>Prikbord</span>
            {!hasReal && <span style={{ fontSize: 9, fontWeight: 700, color: "#A08878", background: "rgba(0,0,0,0.06)", borderRadius: 10, padding: "2px 7px", fontFamily: "system-ui", letterSpacing: 0.3 }}>voorbeeldberichten</span>}
          </div>
          {userId && (
            <button onClick={() => setShowModal(true)} style={{ background: "#2E8FAE", border: "none", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "system-ui", boxShadow: "0 2px 8px rgba(46,143,174,0.3)" }}>
              📌 Prik iets
            </button>
          )}
        </div>
        <div style={{ margin: "10px 12px 12px", background: "linear-gradient(145deg, #E8D4A8 0%, #D8C090 50%, #CEB080 100%)", borderRadius: 10, padding: "18px 10px 14px", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.12)", minHeight: compact ? 180 : 220, position: "relative" as const }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none" as const, backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact ? 18 : 22, position: "relative" as const }}>
            {visible.map(p => <PostCard key={p.id} post={p} compact={compact} />)}
          </div>
          {extra > 0 && (
            <a href={`/spot?id=${spotId}`} style={{ display: "block", marginTop: 14, padding: "8px", background: "rgba(0,0,0,0.08)", borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#7A5C38", textDecoration: "none", fontFamily: "system-ui" }}>
              +{extra} meer berichten
            </a>
          )}
        </div>
        {!compact && (
          <div style={{ textAlign: "center", padding: "0 0 10px", fontSize: 10, color: "#B0A090", letterSpacing: 1, textTransform: "uppercase" as const, fontFamily: "system-ui" }}>
            {spotName}
          </div>
        )}
      </div>
      {showModal && userId && (
        <PostModal spotId={spotId} userId={userId} userName={userName} onClose={() => setShowModal(false)} onPosted={handlePosted} />
      )}
    </>
  );
}
