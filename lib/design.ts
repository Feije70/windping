/* ── lib/design.ts ─────────────────────────────────────────
   WindPing Design System — shared constants
   Warm coastal light theme
   ──────────────────────────────────────────────────────────── */

export const colors = {
  /* ── Backgrounds ── */
  cream: "#F6F1EB",          // Page background — warm off-white
  creamDark: "#EDE7DF",      // Slightly darker — inactive states, slider tracks
  card: "#FFFFFF",            // Card/surface background
  cardBorder: "#E8E0D8",     // Warm border for cards
  cardShadow: "0 1px 4px rgba(31,53,76,0.06)",  // Subtle shadow for cards

  /* ── Brand ── */
  ocean: "#0A2540",           // Kept for legacy/email — dark navy
  sky: "#2E8FAE",             // Primary teal
  skyDark: "#236E8A",
  skyGlow: "rgba(46,143,174,0.12)",
  terra: "#C97A63",           // Terracotta — mascot, accents
  gold: "#E8A83E",            // Epic / gold status
  green: "#3EAA8C",           // Go / success
  amber: "#C97A63",           // Warning — terracotta
  purple: "#8B7EC8",

  /* ── Text ── */
  navy: "#1F354C",            // Primary text
  sub: "#6B7B8F",             // Secondary text
  muted: "#8A9BB0",           // Tertiary / disabled text
  text: "#0F172A",            // Used in login/signup cards
  textSub: "#475569",         // Used in login/signup cards

  /* ── Status tinted backgrounds ── */
  epicBg: "#FFF8EC",          // Light gold tint
  goBg: "#ECFAF4",            // Light green tint
  terraTint: "#FFF5F2",       // Light terracotta tint
  oceanTint: "#EFF8FB",       // Light teal/ocean tint
} as const;

export const fonts = {
  heading: "var(--font-bebas-neue), var(--font-bebas), Impact, sans-serif",
  body: "var(--font-dm-sans), var(--font-dm), system-ui, sans-serif",
} as const;