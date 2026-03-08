"use client";

import { useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY, getValidToken } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Design tokens ──────────────────────────────────────────────────────────
const WOOD = {
  dark:   "#6B4226",
  mid:    "#8B5E3C",
  light:  "#A0714F",
  grain:  "rgba(0,0,0,0.06)",
  cork:   "#C9A96E",
  corkDark: "#B8934A",
};

const TYPE_STYLE: Record<PostType, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  go:       { label: "IK GA!",   emoji: "🤙", color: "#2A7A5C", bg: "#D4F0E4", border: "#A8DFC8" },
  report:   { label: "RAPPORT",  emoji: "🌊", color: "#1A5F7A", bg: "#D6EEF7", border: "#A8D8EE" },
  tip:      { label: "TIP",      emoji: "📌", color: "#8B5E10", bg: "#FEF3D0", border: "#F0D898" },
  warning:  { label: "LET OP",   emoji: "⚠️", color: "#A0290A", bg: "#FDE8E4", border: "#F4B8AA" },
  question: { label: "VRAAG",    emoji: "❓", color: "#5B3D8A", bg: "#EDE6F7", border: "#C8B4E8" },
};

// ── Placeholder posts (lichtgrijs, uitgevaagd) ─────────────────────────────
const PLACEHOLDERS: PrikbordPost[] = [
  { id: -1, type: "tip",      content: "Skeg gevonden op het strand, afgegeven bij de surfschool.",        author_name: "Marieke",      created_at: new Date(Date.now() - 2*3600000).toISOString(),  isPlaceholder: true },
  { id: -2, type: "warning",  content: "Parkeerplaats noord afgesloten t/m 12 maart i.v.m. wegwerkzaamheden.", author_name: "SpotBeheer", created_at: new Date(Date.now() - 24*3600000).toISOString(), isPlaceholder: true },
  { id: -3, type: "go",       content: "Morgenochtend 10u bij de uitrit noord. Wie mee?",                   author_name: "Feije",        created_at: new Date(Date.now() - 3*3600000).toISOString(),  isPlaceholder: true },
  { id: -4, type: "report",   content: "Het is windstil dit weekend helaas. Volgende week beter.",          author_name: "Tsjerk",       created_at: new Date(Date.now() - 5*3600000).toISOString(),  isPlaceholder: true },
  { id: -5, type: "question", content: "BBQ bij paal 8 vanavond? Wie doet mee?",                           author_name: "Sanne",        created_at: new Date(Date.now() - 6*3600000).toISOString(),  isPlaceholder: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m geleden`;
  if (diff < 1440) return `${Math.floor(diff / 60)}u geleden`;
  return `${Math.floor(diff / 1440)}d geleden`;
}

// ── PrikPin (decorative pushpin) ──────────────────────────────────────────
function PrikPin({ color = "#C0392B" }: { color?: string }) {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 3, filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.3))" }}>
      <circle cx="7" cy="6" r="5.5" fill={color} />
      <circle cx="5.5" cy="4.5" r="1.5" fill="rgba(255,255,255,0.4)" />
      <line x1="7" y1="11" x2="7" y2="20" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── PostCard ───────────────────────────────────────────────────────────────
function PostCard({ post, compact = false }: { post: PrikbordPost; compact?: boolean }) {
  const t = TYPE_STYLE[post.type];
  const isPlaceholder = post.isPlaceholder;

  // Subtiele rotatie per post (deterministisch op basis van id)
  const rot = isPlaceholder ? ((Math.abs(post.id) * 7) % 5) - 2.5 : ((post.id * 3) % 5) - 2;

  return (
    <div style={{
      position: "relative",
      background: isPlaceholder ? "#F5F5F5" : t.bg,
      border: `1.5px solid ${isPlaceholder ? "#E0E0E0" : t.border}`,
      borderRadius: 4,
      padding: compact ? "18px 12px 12px" : "20px 14px 14px",
      transform: `rotate(${rot}deg)`,
      boxShadow: isPlaceholder
        ? "2px 3px 8px rgba(0,0,0,0.08)"
        : "2px 3px 10px rgba(0,0,0,0.14)",
      opacity: isPlaceholder ? 0.55 : 1,
      transition: "transform 0.15s, box-shadow 0.15s",
      cursor: isPlaceholder ? "default" : "pointer",
      fontFamily: "'Georgia', serif",
      minHeight: compact ? 100 : 120,
    }}
      onMouseEnter={e => { if (!isPlaceholder) { (e.currentTarget as HTMLElement).style.transform = `rotate(${rot * 0.3}deg) scale(1.03)`; (e.currentTarget as HTMLElement).style.boxShadow = "4px 6px 16px rgba(0,0,0,0.2)"; } }}
      onMouseLeave={e => { if (!isPlaceholder) { (e.currentTarget as HTMLElement).style.transform = `rotate(${rot}deg)`; (e.currentTarget as HTMLElement).style.boxShadow = "2px 3px 10px rgba(0,0,0,0.14)"; } }}
    >
      {/* Punaise */}
      <PrikPin color={isPlaceholder ? "#BDBDBD" : t.color} />

      {/* Type label */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 11 }}>{post.emoji || t.emoji}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: isPlaceholder ? "#BDBDBD" : t.color, fontFamily: "system-ui" }}>
          {t.label}
        </span>
        {post.wind_speed && !isPlaceholder && (
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: t.color }}>{post.wind_speed}kn {post.wind_dir}</span>
        )}
      </div>

      {/* Content */}
      <p style={{ fontSize: compact ? 12 : 13, color: isPlaceholder ? "#C0C0C0" : "#2C1810", margin: "0 0 10px", lineHeight: 1.45, fontFamily: "'Georgia', serif" }}>
        {post.content}
      </p>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: isPlaceholder ? "#CCCCCC" : t.color, fontFamily: "system-ui" }}>{post.author_name}</span>
        <span style={{ fontSize: 10, color: isPlaceholder ? "#CCCCCC" : "#9B8B7A", fontFamily: "system-ui" }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

// ── Post Modal ─────────────────────────────────────────────────────────────
function PostModal({ spotId, userId, userName, onClose, onPosted }: {
  spotId: number; userId: number; userName: string;
  onClose: () => void; onPosted: (post: PrikbordPost) => void;
}) {
  const [type, setType] = useState<PostType>("report");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePost() {
    if (!content.trim()) { setError("Schrijf eerst iets."); return; }
    setSaving(true);
    setError("");
    try {
      const token = await getValidToken();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_posts`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ spot_id: spotId, user_id: userId, author_name: userName, type, content: content.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const [newPost] = await res.json();
      onPosted(newPost);
      onClose();
    } catch (e) {
      setError("Kon niet opslaan. Probeer opnieuw.");
    }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#FBF7F0", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: "#D4C4B0", borderRadius: 2, margin: "0 auto 20px" }} />

        <div style={{ fontSize: 16, fontWeight: 800, color: "#2C1810", marginBottom: 16, fontFamily: "system-ui" }}>📌 Prik iets op het bord</div>

        {/* Type keuze */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {(Object.entries(TYPE_STYLE) as [PostType, typeof TYPE_STYLE[PostType]][]).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)} style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: `1.5px solid ${type === k ? v.color : "#E0D8CE"}`,
              background: type === k ? v.bg : "white",
              color: type === k ? v.color : "#9B8B7A",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}>
              <span>{v.emoji}</span> {v.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={
            type === "go" ? "Bijv: Morgen 10u bij de uitrit. Wie mee?" :
            type === "report" ? "Bijv: 19kn NW, strand breed, weinig mensen." :
            type === "tip" ? "Bijv: Bij laagwater uitkijken voor stenen links van de vlaggen." :
            type === "warning" ? "Bijv: Parkeerplaats noord afgesloten t/m 12 maart." :
            "Bijv: Kent iemand een goeie foilrepair in de buurt?"
          }
          rows={4}
          style={{
            width: "100%", borderRadius: 12, border: `1.5px solid ${TYPE_STYLE[type].border}`,
            background: TYPE_STYLE[type].bg, padding: "12px 14px", fontSize: 14,
            color: "#2C1810", fontFamily: "'Georgia', serif", resize: "none",
            outline: "none", lineHeight: 1.5, boxSizing: "border-box",
          }}
          autoFocus
        />

        {error && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6 }}>{error}</div>}

        <button onClick={handlePost} disabled={saving || !content.trim()} style={{
          marginTop: 14, width: "100%", padding: "14px", borderRadius: 14,
          background: saving || !content.trim() ? "#D4C4B0" : `linear-gradient(135deg, ${TYPE_STYLE[type].color}, ${TYPE_STYLE[type].color}BB)`,
          color: "white", fontSize: 14, fontWeight: 800, border: "none", cursor: saving || !content.trim() ? "default" : "pointer",
          fontFamily: "system-ui",
        }}>
          {saving ? "Wordt gepind..." : "📌 Prik op het bord"}
        </button>
      </div>
    </div>
  );
}

// ── Main Prikbord Component ────────────────────────────────────────────────
interface PrikbordProps {
  spotId: number;
  spotName: string;
  userId: number | null;
  userName: string;
  posts: PrikbordPost[];
  onPostAdded?: (post: PrikbordPost) => void;
  compact?: boolean;        // homepage preview mode
  showAll?: boolean;        // spot page: toon alles
}

export default function Prikbord({ spotId, spotName, userId, userName, posts, onPostAdded, compact = false, showAll = false }: PrikbordProps) {
  const [showModal, setShowModal] = useState(false);
  const [localPosts, setLocalPosts] = useState<PrikbordPost[]>(posts);

  // Gebruik echte posts als die er zijn, anders placeholders
  const hasRealPosts = localPosts.length > 0;
  const displayPosts = hasRealPosts ? localPosts : PLACEHOLDERS;
  const visiblePosts = compact ? displayPosts.slice(0, 4) : displayPosts;
  const extraCount = hasRealPosts && !showAll ? displayPosts.length - 4 : 0;

  function handlePosted(post: PrikbordPost) {
    setLocalPosts(prev => [post, ...prev]);
    onPostAdded?.(post);
  }

  return (
    <>
      {/* ── Houten bord ── */}
      <div style={{
        position: "relative",
        background: `linear-gradient(160deg, ${WOOD.mid} 0%, ${WOOD.dark} 100%)`,
        borderRadius: 12,
        padding: "0 0 16px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)",
        overflow: "visible",
      }}>
        {/* Houtnerven overlay */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none",
          backgroundImage: `repeating-linear-gradient(92deg, transparent 0px, transparent 18px, rgba(0,0,0,0.03) 18px, rgba(0,0,0,0.03) 19px), repeating-linear-gradient(178deg, transparent 0px, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 41px)`,
        }} />

        {/* Palen linksboven en rechtsboven */}
        <div style={{ position: "absolute", top: -20, left: 28, width: 12, height: 28, background: `linear-gradient(180deg, ${WOOD.light}, ${WOOD.dark})`, borderRadius: "4px 4px 0 0", boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }} />
        <div style={{ position: "absolute", top: -20, right: 28, width: 12, height: 28, background: `linear-gradient(180deg, ${WOOD.light}, ${WOOD.dark})`, borderRadius: "4px 4px 0 0", boxShadow: "2px 0 4px rgba(0,0,0,0.3)" }} />

        {/* Header balk */}
        <div style={{
          background: `linear-gradient(90deg, ${WOOD.dark} 0%, ${WOOD.mid} 50%, ${WOOD.dark} 100%)`,
          borderRadius: "12px 12px 0 0", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `2px solid ${WOOD.dark}`,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", fontFamily: "system-ui" }}>Prikbord</span>
            {!hasRealPosts && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontStyle: "italic", fontFamily: "system-ui" }}>voorbeeldberichten</span>
            )}
          </div>
          {userId && (
            <button onClick={() => setShowModal(true)} style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 20, padding: "5px 12px", color: "white", fontSize: 11, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "system-ui",
              backdropFilter: "blur(4px)",
            }}>
              📌 Prik iets
            </button>
          )}
        </div>

        {/* Cork board */}
        <div style={{
          margin: "12px 14px",
          background: `radial-gradient(ellipse at 30% 40%, #D4A96A 0%, ${WOOD.cork} 40%, ${WOOD.corkDark} 100%)`,
          borderRadius: 8,
          padding: "20px 12px 16px",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(0,0,0,0.1)",
          minHeight: compact ? 200 : 260,
        }}>
          {/* Kurk textuur stippen */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 8, pointerEvents: "none", opacity: 0.4,
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }} />

          {/* Posts grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))",
            gap: compact ? 20 : 24,
            position: "relative",
          }}>
            {visiblePosts.map(post => (
              <PostCard key={post.id} post={post} compact={compact} />
            ))}
          </div>

          {/* Meer berichten */}
          {extraCount > 0 && (
            <a href={`/spot?id=${spotId}`} style={{
              display: "block", marginTop: 16, padding: "10px",
              background: "rgba(0,0,0,0.12)", borderRadius: 8, textAlign: "center",
              fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)",
              textDecoration: "none", fontFamily: "system-ui",
            }}>
              +{extraCount} meer berichten bekijken
            </a>
          )}

          {/* Lege state (als geen posts en niet placeholder) */}
          {!hasRealPosts && localPosts.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px 0 8px", position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontStyle: "italic", fontFamily: "system-ui" }}>
                Voorbeeldberichten — prik zelf het eerste echte bericht
              </p>
            </div>
          )}
        </div>

        {/* Footer: naam spot */}
        {!compact && (
          <div style={{ textAlign: "center", paddingBottom: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "system-ui", letterSpacing: 1 }}>{spotName.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Post modal */}
      {showModal && userId && (
        <PostModal
          spotId={spotId} userId={userId} userName={userName}
          onClose={() => setShowModal(false)}
          onPosted={handlePosted}
        />
      )}
    </>
  );
}
