/* ── app/components/SessionIcons.tsx ──────────────────────
   SVG iconen voor sessie logging: Rating, Gear, Prop, WindFeel, Badge
──────────────────────────────────────────────────────────── */
"use client";

import { RATING_COLORS, getBadgeColor } from "@/lib/constants/session";

export function RatingIcon({ value, selected, size = 32 }: { value: number; selected: boolean; size?: number }) {
  const color = selected ? RATING_COLORS[value] : "#B0BAC5";
  const paths: Record<number, React.ReactNode> = {
    1: (<><line x1="12" y1="6" x2="12" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M12 6 Q14 7 14 10 Q14 13 12 14" stroke={color} strokeWidth="1.8" fill={`${color}20`} strokeLinecap="round" /><path d="M4 26 Q12 24 20 26 Q28 28 28 26" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" /></>),
    2: (<><path d="M6 14 Q10 12 14 14 Q18 16 22 14" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M8 20 Q12 18 16 20 Q20 22 24 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" /><path d="M26 10 L22 12 L26 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>),
    3: (<><path d="M4 12 Q8 8 14 12 Q20 16 26 12" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" /><path d="M6 19 Q10 16 16 19 Q22 22 28 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M22 6 L28 9 L22 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /><line x1="10" y1="8" x2="20" y2="6" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" /></>),
    4: (<><path d="M3 13 Q8 7 15 13 Q22 19 28 11" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" /><path d="M5 21 Q10 16 17 21 Q24 26 29 19" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M18 3 L24 5 L20 10 Z" fill={`${color}30`} stroke={color} strokeWidth="1.5" strokeLinejoin="round" /><line x1="18" y1="3" x2="14" y2="13" stroke={color} strokeWidth="1" strokeDasharray="2 2" /></>),
    5: (<><path d="M2 14 Q7 6 14 14 Q21 22 28 12" stroke={color} strokeWidth="2.8" strokeLinecap="round" fill="none" /><path d="M4 22 Q9 15 16 22 Q23 29 30 20" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" /><path d="M16 2 L24 5 L18 12 Z" fill={`${color}35`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /><line x1="16" y1="2" x2="12" y2="14" stroke={color} strokeWidth="1.2" /><circle cx="6" cy="6" r="2" fill={color} opacity="0.3" /><circle cx="27" cy="7" r="1.5" fill={color} opacity="0.25" /><path d="M3 8 L7 7" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" /><path d="M24 3 L28 4" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" /></>),
  };
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none">{paths[value]}</svg>;
}

export function GearIcon({ id, selected, size = 36 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? "#2E8FAE" : "#B0BAC5";
  const icons: Record<string, React.ReactNode> = {
    kite: (<><path d="M18 4 L28 10 L18 22 L8 10 Z" fill={`${color}20`} stroke={color} strokeWidth="1.8" strokeLinejoin="round" /><line x1="18" y1="22" x2="18" y2="32" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" /><path d="M18 4 L18 22" stroke={color} strokeWidth="1" opacity="0.4" /><path d="M8 10 L28 10" stroke={color} strokeWidth="1" opacity="0.4" /></>),
    windsurf: (<><path d="M10 30 Q16 28 22 30" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" /><line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><path d="M16 8 L26 14 L16 24" fill={`${color}20`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></>),
    wing: (<><ellipse cx="18" cy="16" rx="12" ry="6" fill={`${color}15`} stroke={color} strokeWidth="1.8" /><line x1="18" y1="10" x2="18" y2="22" stroke={color} strokeWidth="1.2" opacity="0.4" /><circle cx="12" cy="16" r="1.5" fill={color} opacity="0.5" /><circle cx="24" cy="16" r="1.5" fill={color} opacity="0.5" /><line x1="18" y1="22" x2="18" y2="30" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" /></>),
    foil: (<><line x1="18" y1="6" x2="18" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M8 26 L28 26" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M10 26 L6 22 Q10 20 14 22 Z" fill={`${color}25`} stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M22 26 L30 22 Q26 20 22 22 Z" fill={`${color}25`} stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M12 6 Q18 4 24 6 Q18 8 12 6" fill={`${color}20`} stroke={color} strokeWidth="1.4" /></>),
  };
  return <svg width={size} height={size} viewBox="0 0 36 36" fill="none">{icons[id]}</svg>;
}

export function PropIcon({ id, selected, size = 44 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? "#2E8FAE" : "#B0BAC5";
  if (id === "kite") return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d="M8 28 Q22 6 36 28" fill={`${color}20`} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 28 Q22 6 36 28" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <line x1="22" y1="10" x2="22" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="12" y1="26" x2="22" y2="40" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <line x1="32" y1="26" x2="22" y2="40" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M16 40 L28 40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (id === "wing") return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <path d="M8 28 Q22 6 36 28" fill={`${color}20`} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 28 Q22 6 36 28" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <line x1="22" y1="10" x2="22" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
      <circle cx="15" cy="24" r="2.5" fill={color} opacity="0.5" />
      <circle cx="29" cy="24" r="2.5" fill={color} opacity="0.5" />
      <line x1="15" y1="24" x2="15" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="24" x2="29" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <line x1="20" y1="38" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 6 L34 14 L20 30" fill={`${color}20`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 38 Q20 36 30 38" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function WindFeelIcon({ id, selected, size = 28 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? "#2E8FAE" : "#B0BAC5";
  const icons: Record<string, React.ReactNode> = {
    underpowered: (<><path d="M4 14 Q10 12 16 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" /><circle cx="20" cy="10" r="1" fill={color} opacity="0.3" /></>),
    perfect: (<><path d="M3 10 Q8 6 14 10 Q20 14 26 10" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M5 17 Q10 14 16 17 Q22 20 28 17" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" /><circle cx="24" cy="6" r="3" fill="none" stroke={color} strokeWidth="1.5" /><path d="M24 3 L24 2 M27 6 L28 6 M24 9 L24 10 M21 6 L20 6" stroke={color} strokeWidth="1" strokeLinecap="round" /></>),
    overpowered: (<><path d="M2 8 Q6 3 12 8 Q18 13 24 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" /><path d="M4 15 Q8 10 14 15 Q20 20 26 13" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M6 22 Q10 18 16 22 Q22 26 28 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" /></>),
    gusty: (<><path d="M4 8 L14 8 Q18 8 16 12" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M6 15 L20 15 Q24 15 22 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M4 22 L12 22 Q15 22 13 25" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" /></>),
  };
  return <svg width={size} height={size} viewBox="0 0 28 28" fill="none">{icons[id]}</svg>;
}

export function BadgeIcon({ id, earned, size = 36 }: { id: string; earned: boolean; size?: number }) {
  const color = earned ? getBadgeColor(id) : "#B0BAC5";
  const bg = earned ? `${getBadgeColor(id)}18` : "#E8ECF0";
  const fillLight = earned ? `${color}40` : "#D0D5DB";

  const paths: Record<string, React.ReactNode> = {
    local_hero: (<>
      <path d="M18 4L6 9v9c0 6.5 5.1 10.8 12 13 6.9-2.2 12-6.5 12-13V9L18 4z" fill={fillLight} />
      <path d="M18 4L6 9v9c0 6.5 5.1 10.8 12 13 6.9-2.2 12-6.5 12-13V9L18 4z" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M18 12l1.5 3.1 3.4.5-2.5 2.4.6 3.4L18 19.7l-3 1.7.6-3.4-2.5-2.4 3.4-.5L18 12z" fill={color} />
    </>),
    storm_chaser: (<>
      <path d="M8 12h16c1.5 0 2.5-1 2-2.2s-2-1.8-3.5-1.8c-.3-2.5-2.5-4-5-4-2.8 0-5 2-5.2 4.5C10 8.7 8 10.2 8 12z" fill={fillLight} />
      <path d="M8 12h16c1.5 0 2.5-1 2-2.2s-2-1.8-3.5-1.8c-.3-2.5-2.5-4-5-4-2.8 0-5 2-5.2 4.5C10 8.7 8 10.2 8 12z" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M19 14l-3.5 5H19l-4 7 1.5-5H13l4-7h2z" fill={color} />
      <path d="M6 17h6M8 21h8M5 25h5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </>),
    ice_surfer: (<>
      <circle cx="18" cy="18" r="12" fill={fillLight} />
      <path d="M18 6v24M8.4 12.6l19.2 10.8M8.4 23.4l19.2-10.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 7.5l3 2.5 3-2.5M15 28.5l3-2.5 3 2.5M7.5 14l2 3.5-2 3.5M28.5 14l-2 3.5 2 3.5M9.5 24.5l3-.5 1-3M26.5 11.5l-3 .5-1 3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </>),
    early_bird: (<>
      <path d="M4 24h28" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 24c0-5.5 4.5-10 10-10s10 4.5 10 10" fill={fillLight} />
      <path d="M8 24c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M18 8v-3M10 12l-2-2M26 12l2-2M6 19H3M33 19h-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </>),
    call_in_sick: (<>
      <rect x="10" y="5" width="12" height="22" rx="3" fill={fillLight} stroke={color} strokeWidth="1.8" />
      <circle cx="16" cy="23" r="1.2" fill={color} />
      <path d="M16 9h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M25 10c2 0 3.5.8 3.5 1.8s-1.2 1.2-2.5 1.2M26 15c1.5 0 3 .6 3 1.5s-1 1.5-2.5 1.5M24 20c2 0 3 .5 3 1.3s-1 1.2-2 1.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </>),
    streak_5: (<>
      <path d="M18 4c0 4-6 8-6 14a8 8 0 0016 0c0-4-2-6-4-8-1 3-3 4-4 2-1-3 2-6-2-8z" fill={fillLight} />
      <path d="M18 4c0 4-6 8-6 14a8 8 0 0016 0c0-4-2-6-4-8-1 3-3 4-4 2-1-3 2-6-2-8z" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M16 20c0-2 1-3 2-4 1 1 2 2 2 4a2 2 0 01-4 0z" fill={color} />
    </>),
  };

  return (
    <div style={{ width: size + 12, height: size + 12, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">{paths[id] || null}</svg>
    </div>
  );
}
