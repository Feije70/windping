"use client";

/* ── W. Ping Mascot Component ─────────────────────────────
   Pin-shaped character matching the WindPing logo.
   
   Usage:
     <WPing />                    — happy, default size
     <WPing mood="epic" />        — gold epic mood
     <WPing mood="stoked" />      — green stoked
     <WPing mood="chill" />       — half-lidded eyes
     <WPing mood="sleep" />       — closed eyes, faded
     <WPing mood="sad" />         — worried brows
     <WPing size={48} />          — custom size (width)
   
   Moods & colors:
     happy   → #C97A63 (terracotta)
     epic    → #D4922E (gold)
     stoked  → #2D8F6F (go green)
     chill   → #C97A63 (terracotta)
     sleep   → #C97A63 at 70% opacity
     sad     → #B06E58 (darker terra)
   ──────────────────────────────────────────────────────── */

type Mood = "happy" | "epic" | "stoked" | "chill" | "sleep" | "sad";

interface WPingProps {
  mood?: Mood;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const MOOD_COLORS: Record<Mood, string> = {
  happy: "#C97A63",
  epic: "#D4922E",
  stoked: "#2D8F6F",
  chill: "#C97A63",
  sleep: "#C97A63",
  sad: "#B06E58",
};

const HIGHLIGHT_COLORS: Record<Mood, string> = {
  happy: "#D4967E",
  epic: "#E8A83E",
  stoked: "#3EBD8C",
  chill: "#D4967E",
  sleep: "#D4967E",
  sad: "#C97A63",
};

export function WPing({ mood = "happy", size = 36, className, style }: WPingProps) {
  const fill = MOOD_COLORS[mood];
  const hl = HIGHLIGHT_COLORS[mood];
  const isSleep = mood === "sleep";
  const showDetail = size >= 32;
  const showHighlight = size >= 28;
  const eye = "#1F354C";
  const w = size;
  const h = size * (76 / 60);

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 60 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {/* Pin body */}
      <path
        d="M30 74 C30 74 52 48 52 30 C52 17.85 42.15 8 30 8 C17.85 8 8 17.85 8 30 C8 48 30 74 30 74Z"
        fill={fill}
        opacity={isSleep ? 0.7 : 1}
      />

      {/* Highlight */}
      {showHighlight && (
        <ellipse cx="22" cy="24" rx="5" ry="6" fill={hl} opacity={mood === "sad" ? 0.25 : mood === "stoked" ? 0.25 : 0.4} />
      )}

      {/* === FACE === */}
      {mood === "happy" && (
        <>
          <ellipse cx="21" cy="28" rx={showDetail ? "3.2" : "4"} ry={showDetail ? "3.6" : "4"} fill="white" />
          <ellipse cx="39" cy="28" rx={showDetail ? "3.2" : "4"} ry={showDetail ? "3.6" : "4"} fill="white" />
          <ellipse cx="22" cy="29" rx={showDetail ? "1.8" : "2.5"} ry={showDetail ? "2.3" : "2.5"} fill={eye} />
          <ellipse cx="40" cy="29" rx={showDetail ? "1.8" : "2.5"} ry={showDetail ? "2.3" : "2.5"} fill={eye} />
          {showDetail && (
            <>
              <circle cx="23.2" cy="27.5" r="0.9" fill="white" />
              <circle cx="41.2" cy="27.5" r="0.9" fill="white" />
            </>
          )}
          {showDetail && (
            <path d="M23 36 Q30 43 37 36" stroke={eye} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          )}
        </>
      )}

      {mood === "epic" && (
        <>
          <ellipse cx="21" cy="27" rx={showDetail ? "4" : "4"} ry={showDetail ? "4.5" : "4"} fill="white" />
          <ellipse cx="39" cy="27" rx={showDetail ? "4" : "4"} ry={showDetail ? "4.5" : "4"} fill="white" />
          <ellipse cx="22" cy="28" rx={showDetail ? "2.2" : "2.5"} ry={showDetail ? "2.8" : "2.5"} fill={eye} />
          <ellipse cx="40" cy="28" rx={showDetail ? "2.2" : "2.5"} ry={showDetail ? "2.8" : "2.5"} fill={eye} />
          {showDetail && (
            <>
              <circle cx="23.5" cy="26.5" r="1.1" fill="white" />
              <circle cx="41.5" cy="26.5" r="1.1" fill="white" />
              <ellipse cx="30" cy="38" rx="4.5" ry="3.5" fill={eye} />
              <path d="M48 14 L49.5 17.5 L53 16 L50.5 19 L54 21 L50.5 21.5 L51.5 25 L49 22.5 L46.5 25 L47.5 21.5 L44 21 L47.5 19Z" fill="#E8A83E" opacity="0.5" />
            </>
          )}
        </>
      )}

      {mood === "stoked" && (
        <>
          <path d="M16 28 Q21 23.5 26 28" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M34 28 Q39 23.5 44 28" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {showDetail && (
            <path d="M21 35 Q30 44 39 35" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </>
      )}

      {mood === "chill" && (
        <>
          <ellipse cx="21" cy="29" rx="3.2" ry="3.2" fill="white" />
          <ellipse cx="39" cy="29" rx="3.2" ry="3.2" fill="white" />
          {/* Eyelids */}
          <path d="M17 27.5 Q21 26 25 27.5 L25 25 Q21 23 17 25 Z" fill={fill} />
          <path d="M35 27.5 Q39 26 43 27.5 L43 25 Q39 23 35 25 Z" fill={fill} />
          <ellipse cx="22" cy="30.5" rx="1.8" ry="1.8" fill={eye} />
          <ellipse cx="40" cy="30.5" rx="1.8" ry="1.8" fill={eye} />
          {showDetail && (
            <path d="M24 37 Q30 41 36 37" stroke={eye} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          )}
        </>
      )}

      {mood === "sleep" && (
        <>
          <path d="M17 29 Q21 26 25 29" stroke={eye} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M35 29 Q39 26 43 29" stroke={eye} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {showDetail && (
            <>
              <text x="44" y="20" fontFamily="system-ui" fontSize="9" fontWeight="800" fill={eye} opacity="0.25">z</text>
              <text x="48" y="14" fontFamily="system-ui" fontSize="7" fontWeight="800" fill={eye} opacity="0.15">z</text>
              <path d="M26 37 Q30 38 34 37" stroke={eye} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
            </>
          )}
        </>
      )}

      {mood === "sad" && (
        <>
          <ellipse cx="21" cy="28" rx={showDetail ? "2.8" : "3.5"} ry={showDetail ? "3.2" : "3.5"} fill="white" />
          <ellipse cx="39" cy="28" rx={showDetail ? "2.8" : "3.5"} ry={showDetail ? "3.2" : "3.5"} fill="white" />
          <ellipse cx="21.5" cy="29.5" rx={showDetail ? "1.5" : "2"} ry={showDetail ? "1.8" : "2"} fill={eye} />
          <ellipse cx="39.5" cy="29.5" rx={showDetail ? "1.5" : "2"} ry={showDetail ? "1.8" : "2"} fill={eye} />
          {showDetail && (
            <>
              <path d="M17 25 Q21 23.5 25 25.5" stroke={eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.4" />
              <path d="M35 25.5 Q39 23.5 43 25" stroke={eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.4" />
              <path d="M24 39 Q30 35 36 39" stroke={eye} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

export default WPing;