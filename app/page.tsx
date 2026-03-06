"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import { Icons } from "@/components/Icons";
import NavBar from "@/components/NavBar";
import { Logo } from "@/components/Logo";
import { WPing } from "@/components/WPing";
import { getEmail, isTokenExpired, getAuthId, getValidToken, clearAuth, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };
const OM_BASE = "https://api.open-meteo.com/v1/forecast";

const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToDir(deg: number) { return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

const RATINGS = [
  { value: 1, label: "Shit" }, { value: 2, label: "Mwah" }, { value: 3, label: "Oké" },
  { value: 4, label: "Lekker!" }, { value: 5, label: "EPIC!" },
];
const RATING_COLORS: Record<number, string> = { 1: "#C97A63", 2: "#D4860B", 3: "#E8A83E", 4: "#2E8FAE", 5: "#3EAA8C" };

function RatingIcon({ value, selected, size = 32 }: { value: number; selected: boolean; size?: number }) {
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

const GEAR_TYPES = [
  { id: "kite", label: "Kite" }, { id: "windsurf", label: "Windsurf" },
  { id: "wing", label: "Wing" }, { id: "foil", label: "Foil" },
];

function GearIcon({ id, selected, size = 36 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? "#2E8FAE" : "#B0BAC5";
  const icons: Record<string, React.ReactNode> = {
    kite: (<><path d="M18 4 L28 10 L18 22 L8 10 Z" fill={`${color}20`} stroke={color} strokeWidth="1.8" strokeLinejoin="round" /><line x1="18" y1="22" x2="18" y2="32" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" /><path d="M18 4 L18 22" stroke={color} strokeWidth="1" opacity="0.4" /><path d="M8 10 L28 10" stroke={color} strokeWidth="1" opacity="0.4" /></>),
    windsurf: (<><path d="M10 30 Q16 28 22 30" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" /><line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><path d="M16 8 L26 14 L16 24" fill={`${color}20`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></>),
    wing: (<><ellipse cx="18" cy="16" rx="12" ry="6" fill={`${color}15`} stroke={color} strokeWidth="1.8" /><line x1="18" y1="10" x2="18" y2="22" stroke={color} strokeWidth="1.2" opacity="0.4" /><circle cx="12" cy="16" r="1.5" fill={color} opacity="0.5" /><circle cx="24" cy="16" r="1.5" fill={color} opacity="0.5" /><line x1="18" y1="22" x2="18" y2="30" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" /></>),
    foil: (<><line x1="18" y1="6" x2="18" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M8 26 L28 26" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M10 26 L6 22 Q10 20 14 22 Z" fill={`${color}25`} stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M22 26 L30 22 Q26 20 22 22 Z" fill={`${color}25`} stroke={color} strokeWidth="1.4" strokeLinejoin="round" /><path d="M12 6 Q18 4 24 6 Q18 8 12 6" fill={`${color}20`} stroke={color} strokeWidth="1.4" /></>),
  };
  return <svg width={size} height={size} viewBox="0 0 36 36" fill="none">{icons[id]}</svg>;
}

const WIND_FEELS = [
  { id: "underpowered", label: "Te weinig" }, { id: "perfect", label: "Perfect" },
  { id: "overpowered", label: "Te veel" }, { id: "gusty", label: "Gusty" },
];

const KITE_SIZES = ["5","6","7","8","9","10","11","12","13","14"];

function PropIcon({ id, selected, size = 44 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? C.sky : "#B0BAC5";
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

function WindFeelIcon({ id, selected, size = 28 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? "#2E8FAE" : "#B0BAC5";
  const icons: Record<string, React.ReactNode> = {
    underpowered: (<><path d="M4 14 Q10 12 16 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" /><circle cx="20" cy="10" r="1" fill={color} opacity="0.3" /></>),
    perfect: (<><path d="M3 10 Q8 6 14 10 Q20 14 26 10" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M5 17 Q10 14 16 17 Q22 20 28 17" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" /><circle cx="24" cy="6" r="3" fill="none" stroke={color} strokeWidth="1.5" /><path d="M24 3 L24 2 M27 6 L28 6 M24 9 L24 10 M21 6 L20 6" stroke={color} strokeWidth="1" strokeLinecap="round" /></>),
    overpowered: (<><path d="M2 8 Q6 3 12 8 Q18 13 24 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" /><path d="M4 15 Q8 10 14 15 Q20 20 26 13" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M6 22 Q10 18 16 22 Q22 26 28 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" /></>),
    gusty: (<><path d="M4 8 L14 8 Q18 8 16 12" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M6 15 L20 15 Q24 15 22 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M4 22 L12 22 Q15 22 13 25" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" /></>),
  };
  return <svg width={size} height={size} viewBox="0 0 28 28" fill="none">{icons[id]}</svg>;
}


async function sbPatch(path: string, body: any) {
  const token = await getValidToken();
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function sbGet(path: string) {
  const token = await getValidToken();
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ═══════════════════════════════════════════════════════════
   BADGE SVG ICONS (filled style)
   ═══════════════════════════════════════════════════════════ */

const BADGE_COLORS: Record<string, string> = {
  local_hero: "#2E8FAE",
  storm_chaser: "#1F354C",
  ice_surfer: "#5BA4C9",
  early_bird: "#E8A83E",
  call_in_sick: "#3EAA8C",
  streak_5: "#C97A63",
};

function getBadgeColor(id: string): string {
  return BADGE_COLORS[id] || "#6B7B8F";
}

function BadgeIcon({ id, earned, size = 36 }: { id: string; earned: boolean; size?: number }) {
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
      <path d="M4 28h28" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
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
      <path d="M4 14h4M4 18h3M4 22h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </>),
  };

  return (
    <div style={{
      width: size + 12, height: size + 12, borderRadius: 14,
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        {paths[id] || null}
      </svg>
    </div>
  );
}

const ALL_BADGES = [
  { id: "local_hero", name: "Local Hero", desc: "10+ sessies op één spot" },
  { id: "storm_chaser", name: "Stormchaser", desc: "Sessie bij 30+ knots" },
  { id: "ice_surfer", name: "Ice Surfer", desc: "Sessie onder 5°C" },
  { id: "early_bird", name: "Dawn Patrol", desc: "Op het water vóór 8:00" },
  { id: "call_in_sick", name: "Called in Sick", desc: "Doordeweeks epic sessie" },
  { id: "streak_5", name: "Wind Junkie", desc: "5 sessies in één week" },
];

/* ═══════════════════════════════════════════════════════════
   FEED — bundel alerts per target_date
   ═══════════════════════════════════════════════════════════ */

interface FeedSpot {
  spotName: string;
  wind: number;
  dir: string;
  gust: number;
}

interface FeedDowngradeSpot {
  spotName: string;
  wind: number;
  dir: string;
  reasons: string[];
}

interface BundledFeedItem {
  targetDate: string;
  dateLabel: string;
  latestCreatedAt: string;
  goSpots: FeedSpot[];
  downgradeSpots: FeedDowngradeSpot[];
  alertType: "go" | "downgrade" | "mixed";
}

function bundleAlertsByDate(alerts: any[]): BundledFeedItem[] {
  const byDate: Record<string, { goSpots: Map<string, FeedSpot>; downgradeSpots: Map<string, FeedDowngradeSpot>; latestCreatedAt: string }> = {};

  for (const a of alerts) {
    const date = a.target_date;
    if (!byDate[date]) {
      byDate[date] = { goSpots: new Map(), downgradeSpots: new Map(), latestCreatedAt: a.created_at };
    }
    if (new Date(a.created_at) > new Date(byDate[date].latestCreatedAt)) {
      byDate[date].latestCreatedAt = a.created_at;
    }

    const spots = a.conditions?.spots || [];
    if (a.alert_type === "go" || a.alert_type === "heads_up" || a.alert_type === "epic") {
      for (const s of spots) {
        const key = s.spotName || String(s.spotId);
        byDate[date].goSpots.set(key, { spotName: s.spotName, wind: s.wind, dir: s.dir, gust: s.gust });
      }
    } else if (a.alert_type === "downgrade") {
      for (const s of spots) {
        const key = s.spotName || String(s.spotId);
        const reasons = a.conditions?.downgradeReasons?.[s.spotId] || [];
        byDate[date].downgradeSpots.set(key, { spotName: s.spotName, wind: s.wind, dir: s.dir, reasons });
      }
    }
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items: BundledFeedItem[] = Object.entries(byDate).map(([date, data]) => {
    const d = new Date(date + "T12:00:00");
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    let dateLabel = "onbekend";
    if (diff === 0) dateLabel = "vandaag";
    else if (diff === 1) dateLabel = "morgen";
    else if (diff === -1) dateLabel = "gisteren";
    else dateLabel = d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });

    const goSpots = Array.from(data.goSpots.values());
    const downgradeSpots = Array.from(data.downgradeSpots.values());

    let alertType: "go" | "downgrade" | "mixed" = "go";
    if (goSpots.length > 0 && downgradeSpots.length > 0) alertType = "mixed";
    else if (downgradeSpots.length > 0) alertType = "downgrade";

    return { targetDate: date, dateLabel, latestCreatedAt: data.latestCreatedAt, goSpots, downgradeSpots, alertType };
  });

  return items
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate))
    .slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════
   SESSION STATS
   ═══════════════════════════════════════════════════════════ */

interface SessionStats {
  total_sessions: number;
  total_spots: number;
  current_streak: number;
  longest_streak: number;
  avg_rating: number | null;
  favorite_spot_id: number | null;
  last_session_date: string | null;
  season_sessions: number;
  badges: string[];
}

interface RecentSession {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: string | null;
  notes: string | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  photo_url: string | null;
  spots?: { display_name: string };
}

function SessionStatsSection({ stats, sessions, spotNames }: { stats: SessionStats; sessions: RecentSession[]; spotNames: Record<number, string> }) {
  const completed = sessions.filter(s => s.status === "completed");
  const hasData = completed.length > 0;

  if (!hasData) {
    return (
      <div style={{ padding: "24px 20px", background: C.card, boxShadow: C.cardShadow, borderRadius: 16, textAlign: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Nog geen sessies</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Klik &apos;Ik ga!&apos; bij je volgende Go-alert<br />om je eerste sessie te starten.</div>
      </div>
    );
  }

  const favSpotName = stats.favorite_spot_id ? (spotNames[stats.favorite_spot_id] || "–") : "–";
  const latest = completed[0];
  const latestSpot = latest ? (latest.spots?.display_name || spotNames[latest.spot_id] || "Spot") : null;
  const ratingLabelsL: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
  const ratingColorsL: Record<number, string> = { 1: "#C97A63", 2: "#D4860B", 3: "#E8A83E", 4: "#2E8FAE", 5: "#3EAA8C" };

  function dateLabelFn(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    const now = new Date();
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
    if (diff === 0) return "Vandaag";
    if (diff === -1) return "Gisteren";
    return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { val: String(stats.total_sessions), label: "Sessies", color: C.navy },
          { val: String(stats.current_streak), label: "Streak", color: C.sky },
          { val: stats.avg_rating ? stats.avg_rating.toFixed(1) : "–", label: "Gem. rating", color: C.gold },
        ].map((s) => (
          <div key={s.label} style={{ padding: "14px 10px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: "12px 14px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{stats.total_spots}</div>
            <div style={{ fontSize: 10, color: C.sub }}>Spots bezocht</div>
          </div>
        </div>
        <div style={{ padding: "12px 14px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.epicBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{favSpotName}</div>
            <div style={{ fontSize: 10, color: C.sub }}>Favoriete spot</div>
          </div>
        </div>
      </div>

      {latest && (
        <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
          {latest.photo_url && (
            <div style={{ position: "relative" }}>
              <img src={latest.photo_url} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(31,53,76,0.85) 100%)" }} />
              <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{latestSpot}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{dateLabelFn(latest.session_date)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {latest.forecast_wind && (
                    <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "5px 9px", textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{latest.forecast_wind}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{latest.forecast_dir ? `${latest.forecast_dir} · KN` : "KN"}</div>
                    </div>
                  )}
                  {latest.rating && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: ratingColorsL[latest.rating], background: `${ratingColorsL[latest.rating]}25`, padding: "4px 10px", borderRadius: 16 }}>
                      {ratingLabelsL[latest.rating]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: "12px 14px 10px" }}>
            {!latest.photo_url && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{latestSpot}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{dateLabelFn(latest.session_date)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {latest.forecast_wind && <div style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{latest.forecast_wind}<span style={{ fontSize: 10 }}>kn</span>{latest.forecast_dir && <span style={{ fontSize: 10, color: C.sub, fontWeight: 500 }}> {latest.forecast_dir}</span>}</div>}
                  {latest.rating && <div style={{ fontSize: 12, fontWeight: 800, color: ratingColorsL[latest.rating] }}>{ratingLabelsL[latest.rating]}</div>}
                </div>
              </div>
            )}
            {(latest.gear_type || latest.gear_size || latest.notes) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(latest.gear_type || latest.gear_size) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {latest.gear_type && <span style={{ fontSize: 11, fontWeight: 600, color: C.sky, background: C.sky + "12", borderRadius: 7, padding: "3px 9px" }}>{latest.gear_type.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}</span>}
                    {latest.gear_size && <span style={{ fontSize: 11, color: C.sub }}>{latest.gear_size}</span>}
                  </div>
                )}
                {latest.notes && <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{latest.notes}</div>}
              </div>
            )}
          </div>
          <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
            {latest.id && (<>
            <a
              href={`https://wa.me/?text=${encodeURIComponent([
                latest.rating ? ({1:"Shit 😬",2:"Mwah 😐",3:"Oké 👌",4:"Lekker! 😎",5:"EPIC! 🤙"} as any)[latest.rating] : "Sessie gelogd",
                `${latestSpot}${latest.forecast_wind ? ` · ${latest.forecast_wind}kn` : ""}${latest.forecast_dir ? ` ${latest.forecast_dir}` : ""}`,
                `via WindPing\nhttps://www.windping.com/sessie/${latest.id}`
              ].join("\n"))}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(37,211,102,0.08)", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#25D366", textDecoration: "none" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <a
              href={`/sessie/${latest.id}`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(14,165,233,0.1)", borderRadius: 10, fontSize: 12, fontWeight: 700, color: C.sky, textDecoration: "none" }}
            >
              Deel sessie →
            </a>
            </>)}
          </div>
        </div>
      )}

      {stats.total_sessions > 3 && (
        <Link href="/mijn-sessies" style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 12, color: C.sky, fontWeight: 600, textDecoration: "none" }}>
          Alle {stats.total_sessions} sessies bekijken →
        </Link>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */

interface SpotSummary { id: number; name: string; ws: number; wd: number; match: "go" | "maybe" | "no"; }

function Dashboard() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [pauseUntil, setPauseUntil] = useState("");
  const [pauseOption, setPauseOption] = useState<"24h" | "48h" | "1w" | "2w" | "custom">("24h");
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ total_sessions: 0, total_spots: 0, current_streak: 0, longest_streak: 0, avg_rating: null, favorite_spot_id: null, last_session_date: null, season_sessions: 0, badges: [] });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [spotNames, setSpotNames] = useState<Record<number, string>>({});
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [friendActivity, setFriendActivity] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [allSpots, setAllSpots] = useState<{id: number; name: string; lat: number; lng: number}[]>([]);

  // Handmatige sessie modal
  const [showManualSession, setShowManualSession] = useState(false);


  // Lees spot terug van spot-select pagina via localStorage
  useEffect(() => {
    function checkSpotFromStorage() {
      const spotId = localStorage.getItem("session_spot_id");
      const spotName = localStorage.getItem("session_spot_name");
      if (spotId && spotName) {
        setManualSpotId(Number(spotId));
        setShowManualSession(true);
        setManualStep(1);
        localStorage.removeItem("session_spot_id");
        localStorage.removeItem("session_spot_name");
      }
    }
    window.addEventListener("focus", checkSpotFromStorage);
    window.addEventListener("popstate", checkSpotFromStorage);
    checkSpotFromStorage();
    return () => { window.removeEventListener("focus", checkSpotFromStorage); window.removeEventListener("popstate", checkSpotFromStorage); };
  }, []);
  const [manualSpotId, setManualSpotId] = useState<number | "">("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualWeather, setManualWeather] = useState<{wind: number; gust: number; dir: number; dirStr: string} | null>(null);
  const [manualWeatherLoading, setManualWeatherLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualStep, setManualStep] = useState<"pick" | 1 | 2 | 3 | 4 | 5 | 6>("pick");
  const [manualRating, setManualRating] = useState<number | null>(null);
  const [manualPropulsion, setManualPropulsion] = useState<"kite" | "wing" | "zeil" | null>(null);
  const [manualBoardOrFoil, setManualBoardOrFoil] = useState<"board" | "foil" | null>(null);
  const [manualBoardType, setManualBoardType] = useState<string | null>(null);
  const [manualSailSize, setManualSailSize] = useState("");
  const [manualBoardLength, setManualBoardLength] = useState("");
  const [manualWindFeel, setManualWindFeel] = useState<string | null>(null);
  const [manualNotes, setManualNotes] = useState("");
  const [manualPhotoUrl, setManualPhotoUrl] = useState<string | null>(null);
  const [manualPhotoUploading, setManualPhotoUploading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualDagdelen, setManualDagdelen] = useState<string[]>([]); // "ochtend" | "middag" | "avond"
  const [allPublicSpots, setAllPublicSpots] = useState<{id: number; name: string; lat: number; lng: number}[]>([]);

  const goSpots = spots.filter(s => s.match === "go");
  const matchColors: Record<string, string> = { go: C.green, maybe: C.gold, no: C.amber };

  const loadData = useCallback(async () => {
    try {
      const email = getEmail();
      if (!email) return;
      const authId = getAuthId();
      const users = await sbGet(`users?auth_id=eq.${encodeURIComponent(authId || "")}&select=id,name,min_wind_speed,max_wind_speed,welcome_shown`);
      if (!users?.length) return;
      const user = users[0];
      setUserName(user.name || email.split("@")[0]);
      setUserId(user.id);
      // Show welcome message first time on homepage
      if (!user.welcome_shown) {
        setShowWelcome(true);
        sbPatch(`users?id=eq.${user.id}`, { welcome_shown: true }).catch(() => {});
      }
      try {
        const pauseData = await sbGet(`user_settings?user_id=eq.${user.id}&select=alerts_paused_until`);
        if (pauseData?.[0]?.alerts_paused_until) {
          const until = new Date(pauseData[0].alerts_paused_until);
          if (until > new Date()) { setPaused(true); setPauseUntil(until.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })); }
        }
      } catch {}
      const userSpots = await sbGet(`user_spots?user_id=eq.${user.id}&select=spot_id`);
      
      // Onboarding check: redirect if not set up
      try {
        const prefs = await sbGet(`alert_preferences?user_id=eq.${user.id}&select=id`);
        const needsOnboarding = !user.name || !userSpots?.length || !prefs?.length;
        if (needsOnboarding) { window.location.href = "/onboarding"; return; }
      } catch {}
      
      if (!userSpots?.length) { setLoading(false); return; }
      const ids = userSpots.map((x: any) => x.spot_id);
      const [spotsData, condsData] = await Promise.all([
        sbGet(`spots?id=in.(${ids.join(",")})&select=id,display_name,latitude,longitude,good_directions`),
        sbGet(`ideal_conditions?user_id=eq.${user.id}&spot_id=in.(${ids.join(",")})&select=spot_id,wind_min,wind_max,directions`),
      ]);
      const names: Record<number, string> = {};
      (spotsData || []).forEach((s: any) => { names[s.id] = s.display_name; });
      
      // Haal ook namen op van spots in recente sessies die niet in user_spots zitten
      try {
        const sessRes2 = await sbGet(`sessions?created_by=eq.${user.id}&order=id.desc&limit=10&select=spot_id`);
        const sessionSpotIds = (sessRes2 || []).map((s: any) => s.spot_id).filter((id: number) => !names[id]);
        if (sessionSpotIds.length > 0) {
          const extraSpots = await sbGet(`spots?id=in.(${sessionSpotIds.join(",")})&select=id,display_name`);
          (extraSpots || []).forEach((s: any) => { names[s.id] = s.display_name; });
        }
      } catch {}
      
      setSpotNames(names);
      setAllSpots((spotsData || []).filter((s: any) => s.latitude && s.longitude).map((s: any) => ({ id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude })));
      // Load ALL public spots for manual session spot picker
      try {
        const publicSpots = await sbGet(`spots?select=id,display_name,latitude,longitude&order=display_name.asc`);
        setAllPublicSpots((publicSpots || []).filter((s: any) => s.latitude && s.longitude).map((s: any) => ({ id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude })));
      } catch {}
      const conds: Record<number, any> = {};
      (condsData || []).forEach((ic: any) => { conds[ic.spot_id] = ic; });
      const valid = (spotsData || []).filter((s: any) => s.latitude && s.longitude);
      const results: SpotSummary[] = [];
      await Promise.all(valid.map(async (s: any) => {
        try {
          const res = await fetch(`${OM_BASE}?latitude=${s.latitude}&longitude=${s.longitude}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=auto`);
          const w = await res.json();
          const ws = Math.round(w.current?.wind_speed_10m || 0);
          const wd = w.current?.wind_direction_10m || 0;
          const ic = conds[s.id];
          const wMin = ic?.wind_min ?? 15;
          const wMax = ic?.wind_max ?? 25;
          const dirs = ic?.directions?.length ? ic.directions : (s.good_directions || []);
          const dirOk = dirs.length === 0 || dirs.includes(degToDir(wd));
          const speedOk = ws >= wMin && ws <= wMax;
          results.push({ id: s.id, name: s.display_name, ws, wd, match: speedOk && dirOk ? "go" : speedOk || dirOk ? "maybe" : "no" });
        } catch {}
      }));
      results.sort((a, b) => { const o: Record<string, number> = { go: 0, maybe: 1, no: 2 }; return o[a.match] - o[b.match]; });
      setSpots(results);
      try {
        const since = new Date(); since.setDate(since.getDate() - 7);
        const alertData = await sbGet(`alert_history?user_id=eq.${user.id}&target_date=gte.${since.toISOString().split("T")[0]}&order=created_at.desc&limit=20`);
        setRecentAlerts(alertData || []);
      } catch {}
      try {
        const token = await getValidToken();
        if (token) {
          const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${user.id}&order=id.desc&limit=10&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,photo_url,notes`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          if (sessRes.ok) setRecentSessions(await sessRes.json() || []);
          const statsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_stats?user_id=eq.${user.id}&select=*`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData?.[0]) {
              const s = statsData[0];
              const badges = typeof s.badges === "string" ? JSON.parse(s.badges) : (s.badges || []);
              setSessionStats({ ...s, badges });
              setEarnedBadges(badges);
            }
          }
        }
      } catch (e) { console.error("Session stats load error:", e); }
      // Load friend activity
      try {
        const token = await getValidToken();
        if (token) {
          const actRes = await fetch("/api/friends?type=activity", {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
          });
          if (actRes.ok) {
            const actData = await actRes.json();
            setFriendActivity(actData.activity || []);
          }
        }
      } catch (e) { console.error("Friend activity load error:", e); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
  const today = new Date().toISOString().split("T")[0];
  const feedItems = bundleAlertsByDate(recentAlerts).filter(item => item.targetDate >= today);

  // Fetch weer voor handmatige sessie
  const fetchManualWeather = async (spotId: number, date: string, dagdelen: string[]) => {
    const spot = allSpots.find(s => s.id === spotId);
    if (!spot) return;
    setManualWeatherLoading(true);
    setManualWeather(null);
    try {
      const url = `${OM_BASE}?latitude=${spot.lat}&longitude=${spot.lng}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam&start_date=${date}&end_date=${date}`;
      const res = await fetch(url);
      const data = await res.json();
      // Bepaal uren op basis van geselecteerde dagdelen
      const ranges: number[] = [];
      if (dagdelen.includes("ochtend")) for (let h = 6; h < 12; h++) ranges.push(h);
      if (dagdelen.includes("middag"))  for (let h = 12; h < 17; h++) ranges.push(h);
      if (dagdelen.includes("avond"))   for (let h = 17; h <= 21; h++) ranges.push(h);
      const hours = ranges.length > 0 ? ranges : [12]; // fallback: middag
      const winds = hours.map(h => data.hourly.wind_speed_10m[h] || 0);
      const gusts = hours.map(h => data.hourly.wind_gusts_10m[h] || 0);
      const dirs  = hours.map(h => data.hourly.wind_direction_10m[h] || 0);
      const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      const wind = avg(winds);
      const gust = avg(gusts);
      const dir  = avg(dirs);
      const dirStr = degToDir(dir);
      setManualWeather({ wind, gust, dir, dirStr });
    } catch { setManualWeather(null); }
    setManualWeatherLoading(false);
  };

  function manualBuildGearType(): string {
    const parts: string[] = [];
    if (manualPropulsion) parts.push(manualPropulsion === "zeil" ? "windsurf" : manualPropulsion);
    if (manualBoardOrFoil === "foil") parts.push("foil");
    else if (manualBoardType) parts.push(manualBoardType);
    return parts.join("-") || "unknown";
  }

  function manualBuildGearSize(): string | null {
    const parts: string[] = [];
    if (manualSailSize.trim()) parts.push(manualSailSize.trim() + "m²");
    if (manualBoardLength.trim()) parts.push(`board ${manualBoardLength.trim()}cm`);
    return parts.length ? parts.join(", ") : null;
  }

  function resetManualSession() {
    setManualStep("pick");
    setManualSpotId("");
    setManualDate(new Date().toISOString().split("T")[0]);
    setManualWeather(null);
    setManualRating(null);
    setManualPropulsion(null);
    setManualBoardOrFoil(null);
    setManualBoardType(null);
    setManualSailSize("");
    setManualBoardLength("");
    setManualWindFeel(null);
    setManualNotes("");
    setManualPhotoUrl(null);
    setManualError("");
    setManualDagdelen([]);
  }

  const handleManualSessionSave = async () => {
    if (!manualSpotId || !manualRating || !userId) return;
    setManualSaving(true);
    setManualError("");
    try {
      const token = await getValidToken();
      const body: any = {
        created_by: userId,
        spot_id: manualSpotId,
        session_date: manualDate,
        status: "completed",
        rating: manualRating,
        gear_type: manualBuildGearType(),
        gear_size: manualBuildGearSize(),
      };
      if (manualWindFeel) body.wind_feel = manualWindFeel;
      if (manualDagdelen.length > 0) body.notes = [manualDagdelen.join("/"), manualNotes].filter(Boolean).join(" · ");
      else if (manualNotes) body.notes = manualNotes;
      if (manualPhotoUrl) body.photo_url = manualPhotoUrl;
      if (manualWeather) {
        body.forecast_wind = manualWeather.wind;
        body.forecast_gust = manualWeather.gust;
        body.forecast_dir = manualWeather.dirStr;
      }
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!saveRes.ok) { setManualError("Opslaan mislukt: " + saveRes.status); setManualSaving(false); return; }
      const saved = await saveRes.json();
      const newSessionId = saved?.[0]?.id;
      // Notify friends (fire and forget)
      if (newSessionId) {
        fetch(`/api/sessions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: newSessionId, _notify_only: true }),
        }).catch(() => {});
      }
      setShowManualSession(false);
      resetManualSession();
      loadData();
    } catch { setManualError("Opslaan mislukt, probeer opnieuw."); }
    setManualSaving(false);
  };


  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px" }}>
        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ ...h, fontSize: 24, fontWeight: 800, margin: "0 0 3px", color: C.navy }}>{greeting} {userName ? userName.split(" ")[0] : ""}</h2>
          <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>
            {loading ? "Je spots checken..." : goSpots.length > 0 ? <><strong style={{ color: C.green }}>{goSpots.length} spot{goSpots.length > 1 ? "s" : ""}</strong> zijn nu Go!</> : recentAlerts.some(a => a.alert_type === "go") ? "Niet nu, maar er komen Go-dagen aan!" : spots.length > 0 ? "Nu even geen wind op je spots" : "Voeg spots toe om te beginnen"}
          </p>
        </div>

        {/* Paused */}
        {paused && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: C.epicBg, border: "1px solid rgba(212,146,46,0.2)", borderRadius: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>⏸️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Alerts gepauzeerd</div>
              <div style={{ fontSize: 11, color: C.sub }}>Tot {pauseUntil}</div>
            </div>
            <button onClick={() => setPaused(false)} style={{ padding: "6px 12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Hervatten</button>
          </div>
        )}

        {/* Wind Check strip */}
        {!loading && spots.length > 0 && (
          <Link href="/check" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, marginBottom: 20, textDecoration: "none", color: C.navy }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: goSpots.length > 0 ? C.goBg : C.oceanTint, border: `1.5px solid ${goSpots.length > 0 ? "rgba(45,143,111,0.2)" : C.cardBorder}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: goSpots.length > 0 ? C.green : C.muted, lineHeight: 1 }}>{goSpots.length}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: C.sub }}>GO</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Wind Check</div>
              <div style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {spots.slice(0, 3).map((s, i) => (<span key={s.id}>{i > 0 ? " · " : ""}<span style={{ color: matchColors[s.match], fontWeight: 700 }}>{s.ws}kn</span> {s.name}</span>))}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        )}

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          <button onClick={() => setShowPause(!showPause)} style={{ padding: "12px 4px", background: C.card, boxShadow: "0 1px 3px rgba(31,53,76,0.05)", border: `1px solid ${showPause ? "rgba(212,146,46,0.15)" : "rgba(31,53,76,0.03)"}`, borderRadius: 14, fontSize: 10, fontWeight: 600, color: showPause ? C.gold : C.sub, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", textAlign: "center" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: showPause ? C.epicBg : C.terraTint, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={showPause ? C.gold : C.amber} strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></div>
            Pauzeer
          </button>
          {[
            { href: "/add-spot", label: "Spot +", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>, bg: C.terraTint },
            { href: "/spots", label: "Spots", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>, bg: "#EDE6F0" },
            { href: "/mijn-spots", label: "Mijn Spots", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2.2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>, bg: C.oceanTint },
            { href: "/vrienden", label: "Buddies", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, bg: C.goBg },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ padding: "12px 4px", background: C.card, boxShadow: "0 1px 3px rgba(31,53,76,0.05)", border: "1px solid rgba(31,53,76,0.03)", borderRadius: 14, fontSize: 10, fontWeight: 600, color: C.sub, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none", textAlign: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</div>
              {a.label}
            </Link>
          ))}
        </div>

        {/* Pause options (expands under quick action) */}
        {showPause && !paused && (
          <div style={{ marginBottom: 24, padding: "16px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, boxShadow: C.cardShadow }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {([["24h", "24 uur"], ["48h", "48 uur"], ["1w", "1 week"], ["2w", "2 weken"], ["custom", "Kies datum"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setPauseOption(val)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: pauseOption === val ? C.gold : C.cream, color: pauseOption === val ? "#FFF" : C.sub, border: `1px solid ${pauseOption === val ? C.gold : C.cardBorder}` }}>{label}</button>
              ))}
            </div>
            {pauseOption === "custom" && <input type="date" min={new Date().toISOString().split("T")[0]} style={{ width: "100%", padding: "10px 14px", background: C.cream, border: `1px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 13, color: C.navy, marginBottom: 12 }} onChange={(e) => setPauseUntil(e.target.value)} />}
            <button onClick={() => { setPaused(true); setShowPause(false); setPauseUntil(pauseOption === "custom" ? pauseUntil : pauseOption === "24h" ? "morgen" : pauseOption === "48h" ? "overmorgen" : pauseOption === "1w" ? "volgende week" : "over 2 weken"); }} style={{ width: "100%", padding: "11px", background: C.gold, border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Pauzeer alerts</button>
          </div>
        )}

        {/* ── BUNDLED FEED ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
            <span style={{ ...h, fontSize: 17, fontWeight: 700, color: C.navy }}>Feed</span>
            {feedItems.length > 0 && <a href="/alert" style={{ fontSize: 12, color: C.sky, textDecoration: "none", fontWeight: 600 }}>Alle alerts →</a>}
          </div>
          {feedItems.map((item) => {
            const timeAgo = (() => { const mins = Math.round((Date.now() - new Date(item.latestCreatedAt).getTime()) / 60000); if (mins < 60) return `${mins}m geleden`; const hrs = Math.round(mins / 60); if (hrs < 24) return `${hrs}u geleden`; return `${Math.round(hrs / 24)}d geleden`; })();
            const hasGo = item.goSpots.length > 0;
            const hasDowngrade = item.downgradeSpots.length > 0;
            const accentColor = hasGo ? C.green : C.amber;
            return (
              <a href="/alert" key={item.targetDate} style={{ textDecoration: "none", color: "inherit", display: "block", marginBottom: 10 }}>
                <div style={{ padding: "14px 16px", background: C.card, borderLeft: `3px solid ${accentColor}`, borderRadius: 13, boxShadow: C.cardShadow }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, display: "flex", alignItems: "center", gap: 5 }}>
                      {hasGo ? (
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: C.green, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      ) : (
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: C.amber, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
                        </span>
                      )}
                      {hasGo ? `Go voor ${item.dateLabel}!` : `Verslechterd (${item.dateLabel})`}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{timeAgo}</div>
                  </div>
                  {hasGo && (
                    <div>
                      <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                        {item.goSpots.slice(0, 3).map((s: any, i: number) => (
                          <span key={i}>{i > 0 ? " · " : ""}<span style={{ fontWeight: 600, color: C.navy }}>{s.spotName}</span> <span style={{ color: C.green, fontWeight: 700 }}>{s.wind}kn</span> {s.dir}</span>
                        ))}
                        {item.goSpots.length > 3 && <span style={{ color: C.muted }}> (+{item.goSpots.length - 3} meer)</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {item.goSpots.slice(0, 3).map((s: any, i: number) => (
                          <button key={i} id={`go_${s.spotId}_${item.targetDate}`} onClick={async (e) => {
                            e.preventDefault(); e.stopPropagation();
                            if (!userId) return;
                            const btn = e.currentTarget;
                            if (btn.dataset.going === "true") return;
                            try {
                              const token = await getValidToken();
                              await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
                                method: "POST",
                                headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
                                body: JSON.stringify({ created_by: userId, spot_id: s.spotId, session_date: item.targetDate, status: "going", forecast_wind: s.wind, forecast_dir: s.dir }),
                              });
                              btn.dataset.going = "true"; btn.textContent = "Je gaat! \u2713"; btn.style.background = C.green; btn.style.color = "#fff"; btn.style.borderColor = C.green;
                            } catch (err) { console.error("Ik ga error:", err); }
                          }} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.cardBorder}`, background: C.goBg, color: C.green }}>
                            Ik ga &rarr; {s.spotName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasDowngrade && hasGo && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.cardBorder}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 2 }}>⬇️ Verslechterd</div>
                      <div style={{ fontSize: 12, color: C.sub }}>
                        {item.downgradeSpots.map((s: any, i: number) => (<span key={i}>{i > 0 ? " · " : ""}{s.spotName} {s.wind}kn</span>))}
                      </div>
                    </div>
                  )}
                  {hasDowngrade && !hasGo && (
                    <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                      {item.downgradeSpots.map((s: any, i: number) => (<span key={i}>{i > 0 ? " · " : ""}{s.spotName} {s.wind}kn {s.dir}</span>))}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
          {/* Friend activity */}
          {friendActivity.map((a: any) => {
            const timeAgo = (() => { const mins = Math.round((Date.now() - new Date(a.goingAt).getTime()) / 60000); if (mins < 60) return `${mins}m geleden`; const hrs = Math.round(mins / 60); if (hrs < 24) return `${hrs}u geleden`; return `${Math.round(hrs / 24)}d geleden`; })();
            return (
              <div key={a.id} style={{ padding: "12px 16px", background: C.card, borderLeft: `3px solid ${C.sky}`, borderRadius: 13, boxShadow: C.cardShadow, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.oceanTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.sky, flexShrink: 0 }}>
                  {a.friendName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.4 }}>
                    <strong style={{ color: C.navy }}>{a.friendName}</strong>
                    {a.status === "completed" ? " was op " : " gaat naar "}
                    <strong style={{ color: C.sky }}>{a.spotName}</strong>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{timeAgo}</div>
              </div>
            );
          })}

          {/* W. Ping message */}
          <div style={{ padding: "13px 16px", background: C.oceanTint, borderRadius: 13, border: "1px solid rgba(46,111,126,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}><WPing mood={showWelcome || goSpots.length > 0 ? "happy" : "sleep"} size={22} /></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>W. Ping</div>
              <div style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>nu</div>
            </div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              {showWelcome ? (
                <div>
                  <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>Welkom bij WindPing, {userName}! 🤙</div>
                  <div style={{ marginBottom: 10 }}>Fijn dat je er bent. Dit kun je allemaal doen:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{Icons.wind({ color: C.sky, size: 15 })}</span>
                      <span><strong>Check</strong> — zie de huidige wind op al je spots in één oogopslag</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{Icons.mapPin({ color: C.sky, size: 15 })}</span>
                      <span><strong>Spots</strong> — voeg je favoriete spots toe en stel windcondities in</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{Icons.calendar({ color: C.sky, size: 15 })}</span>
                      <span><strong>Sessies</strong> — log je sessies en bekijk je statistieken en badges</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{Icons.users({ color: C.sky, size: 15 })}</span>
                      <span><strong>Vrienden</strong> — nodig je maten uit, zie wie er gaan en deel je sessies</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{Icons.bell({ color: C.sky, size: 15 })}</span>
                      <span><strong>Alerts</strong> — ik ping je automatisch als het waait op jouw spots</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(46,111,126,0.1)", fontSize: 12, color: C.sub }}>
                    Zet je gear maar alvast klaar. 🤙
                  </div>
                </div>
              ) : spots.length === 0 ? "Voeg je favoriete spots toe en ik houd de wind voor je in de gaten." : goSpots.length > 0 ? `Yes! ${goSpots.length > 1 ? `${goSpots.length} spots zijn` : `${goSpots[0].name} is`} Go vandaag. Tas al ingepakt?` : "Vandaag even geen wind op je spots. Ik houd het in de gaten!"}
              {!showWelcome && friendActivity.length === 0 && spots.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(46,111,126,0.1)" }}>
                  <a href="/vrienden" style={{ fontSize: 12, color: C.sky, fontWeight: 600, textDecoration: "none" }}>
                    🤙 Nodig je kitemaatjes uit en zie wanneer zij het water opgaan →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sessies ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
            <span style={{ ...h, fontSize: 17, fontWeight: 700, color: C.navy }}>Sessies</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setShowManualSession(true); setManualStep("pick"); }} style={{ fontSize: 12, color: C.sky, fontWeight: 600, background: "none", border: `1px solid ${C.sky}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>+ Sessie</button>
              {sessionStats.total_sessions > 0 && <span style={{ fontSize: 11, color: C.sub }}>Seizoen: {sessionStats.season_sessions}</span>}
            </div>
          </div>
          <SessionStatsSection stats={sessionStats} sessions={recentSessions} spotNames={spotNames} />
        </div>

        {/* ── Badges (SVG) ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
            <span style={{ ...h, fontSize: 17, fontWeight: 700, color: C.navy }}>Badges</span>
            <span style={{ fontSize: 11, color: C.muted }}>{earnedBadges.length} / {ALL_BADGES.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {ALL_BADGES.map((b) => {
              const earned = earnedBadges.includes(b.id);
              const badgeColor = getBadgeColor(b.id);
              return (
                <div key={b.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px 14px",
                  borderRadius: 14,
                  background: earned ? `${badgeColor}08` : C.card,
                  border: `1.5px solid ${earned ? `${badgeColor}30` : C.cardBorder}`,
                  boxShadow: earned ? `0 2px 10px ${badgeColor}15` : "0 1px 3px rgba(31,53,76,0.04)",
                  opacity: earned ? 1 : 0.45,
                  transition: "all 0.3s ease",
                }}>
                  <BadgeIcon id={b.id} earned={earned} size={34} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: earned ? badgeColor : C.sub, textAlign: "center", lineHeight: 1.2 }}>{b.name}</div>
                  <div style={{ fontSize: 9, color: earned ? C.navy : C.muted, textAlign: "center", lineHeight: 1.3, padding: "0 2px" }}>{b.desc}</div>
                  {earned && (
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.5px", color: badgeColor, textTransform: "uppercase" }}>✓ Unlocked</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Spot Records */}
        <div style={{ padding: "22px 20px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, textAlign: "center", marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="16" y="8" width="4" height="12" rx="1"/></svg>
          <div style={{ ...h, fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 3 }}>Spot Records</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Binnenkort — koppel je tracker<br />en vergelijk scores op je spots!</div>
        </div>


        {/* ── HANDMATIGE SESSIE MODAL ── */}
        {showManualSession && (() => {
          const userSpotIds = new Set(allSpots.map(s => s.id));
          const otherSpots = allPublicSpots.filter(s => !userSpotIds.has(s.id));
          const manualBoardTypesForProp = manualPropulsion === "zeil"
            ? [{id:"freeride",label:"Freeride"},{id:"wave",label:"Wave"},{id:"freestyle",label:"Freestyle"},{id:"slalom",label:"Race / Slalom"}]
            : manualPropulsion === "wing"
            ? [{id:"wingboard",label:"Wingboard"},{id:"sup",label:"SUP"}]
            : [{id:"twintip",label:"Twintip"},{id:"directional",label:"Directional"},{id:"wave",label:"Wave"},{id:"strapless",label:"Strapless"}];

          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(31,53,76,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 16 }}
              onClick={(e) => { if (e.target === e.currentTarget) { setShowManualSession(false); resetManualSession(); } }}>
              <div style={{ background: C.cream, borderRadius: "20px 20px 20px 20px", width: "100%", maxWidth: 480, padding: "24px 20px 48px", maxHeight: "85vh", overflowY: "auto" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 20, color: C.navy, letterSpacing: 0.5 }}>Sessie loggen</span>
                  <button onClick={() => { setShowManualSession(false); resetManualSession(); }}
                    style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted, lineHeight: 1 }}>×</button>
                </div>

                {/* Progress bar */}
                {manualStep !== "pick" && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
                    {[1,2,3,4,5,6].map(s => (
                      <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: (manualStep as number) >= s ? C.sky : C.cardBorder, transition: "background 0.3s ease" }} />
                    ))}
                  </div>
                )}

                {manualError && (
                  <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 12, color: "#DC2626", marginBottom: 16 }}>{manualError}</div>
                )}

                {/* ── PICK: Spot + datum ── */}
                {manualStep === "pick" && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>SPOT</label>
                      {manualSpotId ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.card, border: `1.5px solid ${C.sky}`, borderRadius: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{allSpots.find(s => s.id === manualSpotId)?.name || otherSpots.find(s => s.id === manualSpotId)?.name || "Spot"}</span>
                          <button onClick={() => setManualSpotId("")} style={{ fontSize: 11, color: C.sky, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Wijzig</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
                            {allSpots.length > 0 ? (
                              <>
                                <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.5 }}>MIJN SPOTS</div>
                                {allSpots.map(s => (
                                  <button key={s.id} onClick={() => setManualSpotId(s.id)}
                                    style={{ padding: "10px 14px", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.cardBorder}`, cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.navy }}>
                                    {s.name}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <div style={{ padding: "12px 14px", fontSize: 13, color: C.muted }}>Geen eigen spots</div>
                            )}
                          </div>
                          <a href="/spot-select" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, textDecoration: "none" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>Andere spot kiezen</span>
                            <span style={{ fontSize: 14, color: C.sky }}>→</span>
                          </a>
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>DATUM</label>
                      <input type="date" value={manualDate} max={new Date().toISOString().split("T")[0]}
                        onChange={e => setManualDate(e.target.value)}
                        style={{ width: "100%", padding: "12px 14px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14, color: C.navy, boxSizing: "border-box", outline: "none" }} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>DAGDEEL</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {([
                          { id: "ochtend", label: "Ochtend", sub: "6–12u" },
                          { id: "middag",  label: "Middag",  sub: "12–17u" },
                          { id: "avond",   label: "Avond",   sub: "17–22u" },
                        ] as const).map(d => {
                          const active = manualDagdelen.includes(d.id);
                          return (
                            <button key={d.id} onClick={() => setManualDagdelen(prev =>
                              prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]
                            )} style={{
                              padding: "12px 6px", borderRadius: 12, border: `2px solid ${active ? C.sky : C.cardBorder}`,
                              background: active ? `${C.sky}12` : C.card, cursor: "pointer", transition: "all 0.2s",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                            }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: active ? C.sky : C.navy }}>{d.label}</span>
                              <span style={{ fontSize: 10, color: C.muted }}>{d.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={async () => { if (!manualSpotId) return; await fetchManualWeather(Number(manualSpotId), manualDate, manualDagdelen); setManualStep(1); }}
                      disabled={!manualSpotId}
                      style={{ width: "100%", padding: "14px", background: manualSpotId ? C.sky : C.cardBorder, border: "none", borderRadius: 12, color: "#FFF", fontSize: 15, fontWeight: 700, cursor: manualSpotId ? "pointer" : "not-allowed", opacity: manualSpotId ? 1 : 0.6 }}>
                      Volgende →
                    </button>
                  </>
                )}

                {/* ── STEP 1: Rating ── */}
                {manualStep === 1 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Hoe was het?</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 16px" }}>Geef je sessie een eerlijke beoordeling</p>
                    {(manualWeatherLoading || manualWeather) && (
                      <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", background: C.goBg, borderRadius: 20, fontSize: 13 }}>
                          {manualWeatherLoading
                            ? <span style={{ color: C.muted }}>Weerdata ophalen...</span>
                            : <><span style={{ fontWeight: 800, color: C.green }}>{manualWeather!.wind}kn</span><span style={{ color: C.sub }}>{manualWeather!.dirStr}</span><span style={{ color: C.muted, fontSize: 11 }}> · gusts {manualWeather!.gust}kn</span></>
                          }
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
                      {RATINGS.map(r => (
                        <button key={r.value} onClick={() => { setManualRating(r.value); setTimeout(() => setManualStep(2), 280); }} style={{
                          width: 58, padding: "14px 0", borderRadius: 16,
                          border: `2px solid ${manualRating === r.value ? RATING_COLORS[r.value] : C.cardBorder}`,
                          background: manualRating === r.value ? `${RATING_COLORS[r.value]}12` : C.card,
                          cursor: "pointer", transition: "all 0.2s",
                          transform: manualRating === r.value ? "scale(1.12)" : "scale(1)",
                          boxShadow: manualRating === r.value ? `0 6px 20px ${RATING_COLORS[r.value]}35` : C.cardShadow,
                          display: "flex", flexDirection: "column", alignItems: "center",
                        }}>
                          <RatingIcon value={r.value} selected={manualRating === r.value} size={32} />
                          <div style={{ fontSize: 9, fontWeight: 800, color: manualRating === r.value ? RATING_COLORS[r.value] : C.muted, marginTop: 6 }}>{r.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Propulsion ── */}
                {manualStep === 2 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Wat reed je?</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 20px" }}>Kite, wing of sail?</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {(["kite","wing","zeil"] as const).map(p => (
                        <button key={p} onClick={() => { setManualPropulsion(p); setManualStep(p === "kite" ? 4 : 3); }} style={{
                          padding: "22px 10px", borderRadius: 16,
                          border: `2px solid ${manualPropulsion === p ? C.sky : C.cardBorder}`,
                          background: manualPropulsion === p ? `${C.sky}12` : C.card,
                          cursor: "pointer", transition: "all 0.2s",
                          boxShadow: manualPropulsion === p ? `0 4px 16px ${C.sky}25` : C.cardShadow,
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                        }}>
                          <PropIcon id={p} selected={manualPropulsion === p} />
                          <div style={{ fontSize: 13, fontWeight: 700, color: manualPropulsion === p ? C.sky : C.navy }}>{p === "zeil" ? "Sail" : p.charAt(0).toUpperCase() + p.slice(1)}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setManualStep(6)} style={{ width: "100%", marginTop: 14, padding: "13px", background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>Overslaan →</button>
                  </div>
                )}

                {/* ── STEP 3: Foil or Board ── */}
                {manualStep === 3 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Foil of board?</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 20px" }}>Wat had je onder je voeten?</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <button onClick={() => { setManualBoardOrFoil("foil"); setManualStep(5); }} style={{
                        padding: "28px 16px", borderRadius: 16,
                        border: `2px solid ${manualBoardOrFoil === "foil" ? C.sky : C.cardBorder}`,
                        background: manualBoardOrFoil === "foil" ? `${C.sky}12` : C.card,
                        cursor: "pointer", transition: "all 0.2s",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                      }}>
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                          <line x1="26" y1="8" x2="26" y2="40" stroke={manualBoardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="2.5" strokeLinecap="round"/>
                          <path d="M10 34 L42 34" stroke={manualBoardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="2.5" strokeLinecap="round"/>
                          <rect x="19" y="5" width="14" height="6" rx="3" fill={manualBoardOrFoil === "foil" ? `${C.sky}20` : "#B0BAC520"} stroke={manualBoardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="1.5"/>
                        </svg>
                        <div style={{ fontSize: 15, fontWeight: 700, color: manualBoardOrFoil === "foil" ? C.sky : C.navy }}>Foil</div>
                      </button>
                      <button onClick={() => { setManualBoardOrFoil("board"); setManualStep(4); }} style={{
                        padding: "28px 16px", borderRadius: 16,
                        border: `2px solid ${manualBoardOrFoil === "board" ? C.sky : C.cardBorder}`,
                        background: manualBoardOrFoil === "board" ? `${C.sky}12` : C.card,
                        cursor: "pointer", transition: "all 0.2s",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                      }}>
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                          <path d="M26 8 Q38 10 40 26 Q38 42 26 44 Q14 42 12 26 Q14 10 26 8Z" fill={manualBoardOrFoil === "board" ? `${C.sky}15` : "#B0BAC515"} stroke={manualBoardOrFoil === "board" ? C.sky : "#B0BAC5"} strokeWidth="1.8"/>
                        </svg>
                        <div style={{ fontSize: 15, fontWeight: 700, color: manualBoardOrFoil === "board" ? C.sky : C.navy }}>Board</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: Board type ── */}
                {manualStep === 4 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Welk type board?</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 16px" }}>
                      {manualPropulsion === "zeil" ? "Windsurf board type" : manualPropulsion === "wing" ? "Board onder de wing" : "Kite board type"}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {manualBoardTypesForProp.map(bt => (
                        <button key={bt.id} onClick={() => { setManualBoardType(bt.id); setManualStep(5); }} style={{
                          padding: "16px 20px", borderRadius: 14, textAlign: "left",
                          border: `2px solid ${manualBoardType === bt.id ? C.sky : C.cardBorder}`,
                          background: manualBoardType === bt.id ? `${C.sky}10` : C.card,
                          cursor: "pointer", transition: "all 0.2s",
                        }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: manualBoardType === bt.id ? C.sky : C.navy }}>{bt.label}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setManualStep(5)} style={{ width: "100%", marginTop: 14, padding: "13px", background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>Overslaan →</button>
                  </div>
                )}

                {/* ── STEP 5: Maten ── */}
                {manualStep === 5 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Maten</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 20px" }}>Optioneel — wat had je op?</p>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>
                        {manualPropulsion === "kite" ? "KITE (m²)" : manualPropulsion === "wing" ? "WING (m²)" : "ZEIL (m²)"}
                      </label>
                      <div style={{ position: "relative" }}>
                        <input type="text" inputMode="decimal" value={manualSailSize}
                          onChange={e => setManualSailSize(e.target.value.replace(/[^0-9.,]/g,"").replace(",","."))}
                          placeholder={manualPropulsion === "zeil" ? "7.6" : manualPropulsion === "wing" ? "5.0" : "12"}
                          style={{ width: "100%", padding: "13px 48px 13px 16px", borderRadius: 12, border: `1.5px solid ${manualSailSize ? C.sky : C.cardBorder}`, fontSize: 16, color: C.navy, background: C.card, boxSizing: "border-box", outline: "none" }} />
                        <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted, pointerEvents: "none" }}>m²</span>
                      </div>
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>BOARD LENGTE (cm)</label>
                      <div style={{ position: "relative" }}>
                        <input type="text" inputMode="numeric" value={manualBoardLength}
                          onChange={e => setManualBoardLength(e.target.value.replace(/[^0-9]/g,""))}
                          placeholder={manualPropulsion === "zeil" ? "245" : "138"}
                          style={{ width: "100%", padding: "13px 48px 13px 16px", borderRadius: 12, border: `1.5px solid ${manualBoardLength ? C.sky : C.cardBorder}`, fontSize: 16, color: C.navy, background: C.card, boxSizing: "border-box", outline: "none" }} />
                        <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted, pointerEvents: "none" }}>cm</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setManualStep(manualBoardOrFoil === "foil" ? 3 : 4)} style={{ padding: "14px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", width: 60 }}>←</button>
                      <button onClick={() => setManualStep(6)} style={{ flex: 1, padding: "14px", background: C.sky, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                        {manualSailSize || manualBoardLength ? "Volgende →" : "Overslaan →"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 6: Details + samenvatting ── */}
                {manualStep === 6 && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <h2 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Details</h2>
                    <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 16px" }}>Hoe voelde het op het water?</p>

                    {/* Wind feel */}
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>HOE VOELDE DE WIND?</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {WIND_FEELS.map(w => (
                          <button key={w.id} onClick={() => setManualWindFeel(manualWindFeel === w.id ? null : w.id)} style={{
                            flex: 1, padding: "12px 6px", borderRadius: 12,
                            border: `2px solid ${manualWindFeel === w.id ? C.sky : C.cardBorder}`,
                            background: manualWindFeel === w.id ? `${C.sky}12` : C.card,
                            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                          }}>
                            <WindFeelIcon id={w.id} selected={manualWindFeel === w.id} size={26} />
                            <div style={{ fontSize: 9, fontWeight: 700, color: manualWindFeel === w.id ? C.sky : C.muted, marginTop: 4 }}>{w.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, letterSpacing: 0.5 }}>NOTITIES (optioneel)</label>
                      <textarea value={manualNotes} onChange={e => setManualNotes(e.target.value)}
                        placeholder="Hoe was het water? Iets bijzonders? Tips voor de volgende keer?"
                        rows={3}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.cardBorder}`, fontSize: 14, color: C.navy, background: C.card, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, outline: "none", fontFamily: "DM Sans, sans-serif" }} />
                    </div>

                    {/* Foto */}
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, letterSpacing: 0.5 }}>FOTO (optioneel)</label>
                      {manualPhotoUrl ? (
                        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                          <img src={manualPhotoUrl} alt="Sessie foto" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                          <button onClick={() => setManualPhotoUrl(null)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </div>
                      ) : (
                        <div onClick={() => { if (!manualPhotoUploading) document.getElementById("manual-photo-input")?.click(); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 16px", borderRadius: 12, border: `2px dashed ${C.cardBorder}`, background: C.card, cursor: manualPhotoUploading ? "not-allowed" : "pointer" }}>
                          {manualPhotoUploading ? (
                            <><div style={{ width: 20, height: 20, border: `2px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /><div style={{ fontSize: 13, color: C.muted }}>Uploaden...</div></>
                          ) : (
                            <><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Tik om foto toe te voegen</div></>
                          )}
                        </div>
                      )}
                      <input id="manual-photo-input" type="file" accept="image/*" style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setManualPhotoUploading(true);
                          setManualError("");
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("session_id", "temp_" + Date.now());
                            const res = await fetch("/api/upload", { method: "POST", body: formData });
                            const data = await res.json();
                            if (res.ok && data.url) { setManualPhotoUrl(data.url); }
                            else { setManualError(`Foto upload mislukt: ${data.error || "onbekend"}`); }
                          } catch { setManualError("Foto upload mislukt."); }
                          setManualPhotoUploading(false);
                          e.target.value = "";
                        }} />
                    </div>

                    {/* Samenvatting */}
                    <div style={{ padding: "14px 16px", background: C.card, borderRadius: 14, boxShadow: C.cardShadow, marginBottom: 20, border: `1px solid ${C.cardBorder}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: 0.5 }}>SAMENVATTING</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {manualRating && <RatingIcon value={manualRating} selected={true} size={36} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                            {[...allSpots, ...otherSpots].find(s => s.id === manualSpotId)?.name}
                          </div>
                          <div style={{ fontSize: 12, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>
                            {new Date(manualDate + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                            {manualPropulsion && ` · ${manualPropulsion === "zeil" ? "windsurf" : manualPropulsion}`}
                            {manualBoardType && ` ${manualBoardType}`}
                            {manualSailSize && ` · ${manualSailSize}m²`}
                            {manualBoardLength && ` · ${manualBoardLength}cm`}
                            {manualWindFeel && ` · ${WIND_FEELS.find(w => w.id === manualWindFeel)?.label}`}
                          </div>
                        </div>
                        {manualWeather && <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>{manualWeather.wind}kn</div>}
                        {manualRating && <div style={{ fontSize: 12, fontWeight: 800, color: RATING_COLORS[manualRating], minWidth: 44, textAlign: "right" }}>{RATINGS.find(r => r.value === manualRating)?.label}</div>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setManualStep(5)} style={{ padding: "14px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", width: 60 }}>←</button>
                      <button onClick={handleManualSessionSave} disabled={manualSaving || manualPhotoUploading}
                        style={{ flex: 1, padding: "14px", background: C.green, color: "#FFF", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (manualSaving || manualPhotoUploading) ? "not-allowed" : "pointer", opacity: (manualSaving || manualPhotoUploading) ? 0.6 : 1 }}>
                        {manualSaving ? "Opslaan..." : "✓ Log sessie"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })()}

        {/* Logout */}
        <button onClick={async () => { await clearAuth(); window.location.href = "/login"; }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 12, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Uitloggen
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════ */

function FeatureCard({ icon, title, desc, color, soon }: { icon: any; title: string; desc: string; color: string; soon?: boolean }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, boxShadow: C.cardShadow, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon({ color, size: 20 })}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{title}</div>
          {soon && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${C.purple}15`, color: C.purple }}>Binnenkort</span>}
        </div>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ flexShrink: 0 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: C.sky, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: 800, fontSize: 14, boxShadow: "0 2px 8px rgba(46,111,126,0.2)" }}>{num}</div></div>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

const features = [
  { icon: Icons.mapPin, title: "Jouw Spots", desc: "Sla je favoriete kite- en windsurfspots op. Wij volgen 393+ locaties met live winddata.", color: C.sky },
  { icon: Icons.bell, title: "Slimme Alerts", desc: "Ontvang dagen van tevoren een melding als de condities matchen. Push en e-mail.", color: C.green },
  { icon: Icons.sliders, title: "Jouw Voorkeuren", desc: "Stel je ideale windsnelheid, richting, getij en temperatuur in.", color: C.gold },
  { icon: Icons.plus, title: "Eigen Spot Toevoegen", desc: "Spot niet in de lijst? Voeg hem zelf toe — privé of gedeeld.", color: C.skyDark },
  { icon: Icons.users, title: "Community", desc: "Zie wie er op het water gaat, deel sessies en ontdek nieuwe spots.", color: C.purple, soon: true },
];

const steps = [
  { num: "1", title: "Kies je spots", desc: "Selecteer spots uit onze database of voeg je eigen geheime plekje toe." },
  { num: "2", title: "Stel je voorkeuren in", desc: "Windsnelheid, richting, temperatuur en de dagen dat jij kunt." },
  { num: "3", title: "Ontvang je ping", desc: "WindPing checkt de forecast en stuurt je een alert zodra het matcht." },
];

function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  return (
    <main style={{ background: C.cream, minHeight: "100vh", overflowX: "hidden" }}>
      <section style={{ position: "relative", minHeight: "92svh", overflow: "hidden", background: "#1A3A4A" }}>
        <img src="/Hero-ocean.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "70% 40%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(26,58,74,0.88) 0%, rgba(26,58,74,0.7) 30%, rgba(26,58,74,0.35) 55%, rgba(26,58,74,0.1) 75%, transparent 100%)", zIndex: 2 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to bottom, transparent 0%, ${C.cream}44 30%, ${C.cream}aa 60%, ${C.cream} 90%)`, zIndex: 3 }} />
        <div style={{ position: "relative", zIndex: 10, minHeight: "92svh", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
            <Logo size={28} dark />
            <Link href="/login" style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "8px 18px", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 10, backdropFilter: "blur(4px)", background: "rgba(255,255,255,0.05)" }}>Log in</Link>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 600, width: "100%", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ maxWidth: 440, opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 24, backdropFilter: "blur(8px)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>Kitesurf &amp; Windsurf Alerts</span>
              </div>
              <h1 style={{ ...h, fontSize: "clamp(3rem, 12vw, 4.2rem)", lineHeight: 0.95, color: "white", margin: "0 0 16px", letterSpacing: -1 }}>
                Stop Checking,<br />
                <span style={{ color: C.terra, position: "relative" }}>
                  Start Riding
                  <svg viewBox="0 0 200 12" style={{ position: "absolute", bottom: -4, left: 0, width: "100%", height: 12, overflow: "visible" }}><path d="M5 8 Q50 2 100 7 Q150 12 195 5" stroke={C.terra} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" /></svg>
                </span>
              </h1>
              <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 360, marginBottom: 32, fontWeight: 400 }}>We&apos;ll let you know when you should go!</p>
              <div style={{ display: "flex", gap: 12, marginBottom: 40, maxWidth: 380 }}>
                <Link href="/signup" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", background: C.terra, color: "#FFF", fontWeight: 700, fontSize: 15, borderRadius: 12, textDecoration: "none", boxShadow: "0 4px 20px rgba(201,122,99,0.4)" }}>Gratis aanmelden <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></Link>
                <Link href="#how" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", background: "white", color: C.navy, fontWeight: 600, fontSize: 14, borderRadius: 12, textDecoration: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>Hoe werkt het?</Link>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "10px 20px", borderRadius: 14, background: "rgba(26,58,74,0.7)", backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>393+ spots</span></div>
                <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>Alerts vooraf</span></div>
                <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>Push alerts</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Meer</span>
            <div style={{ width: 1, height: 24, background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)", animation: "scrollPulse 2s ease-in-out infinite" }} />
          </div>
        </div>
      </section>
      <section style={{ padding: "20px 20px 12px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: C.oceanTint, borderRadius: 16, border: "1px solid rgba(46,111,126,0.08)", marginBottom: 24 }}>
          <WPing mood="happy" size={48} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Hoi, ik ben W. Ping!</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>Ik houd de wind in de gaten en stuur je <strong style={{ color: C.navy }}>dagen van tevoren</strong> een seintje als er een goede sessie aankomt.</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: C.sky, marginBottom: 16 }}>Waarom WindPing</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{features.map((f: any) => <FeatureCard key={f.title} {...f} />)}</div>
      </section>
      <section id="how" style={{ padding: "36px 20px 40px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ padding: "28px 24px", background: C.creamDark, borderRadius: 18 }}>
          <h2 style={{ ...h, fontSize: 20, fontWeight: 800, color: C.navy, marginBottom: 20 }}>Hoe werkt het?</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{steps.map((s) => <StepCard key={s.num} {...s} />)}</div>
        </div>
      </section>
      <section style={{ padding: "0 20px 36px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: "22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><Logo variant="icon" size={28} /><span style={{ fontSize: 12, fontWeight: 700, color: C.sky, letterSpacing: "0.5px" }}>393+ Spots</span></div>
          <h3 style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 6px" }}>Vind Jouw Spot</h3>
          <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.55, margin: "0 0 16px" }}>Ontdek kite- en windsurfspots door heel Europa en Marokko. Staat jouw spot er niet bij? Voeg hem toe.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/spot-select" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", background: C.oceanTint, color: C.sky, fontWeight: 600, fontSize: 13, borderRadius: 12, textDecoration: "none" }}>{Icons.search({ color: C.sky })} Bekijk spots</Link>
            <Link href="/signup" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", background: C.cream, color: C.sub, fontWeight: 600, fontSize: 13, borderRadius: 12, border: `1px solid ${C.cardBorder}`, textDecoration: "none" }}>{Icons.plus({ color: C.sub })} Voeg jouw spot toe</Link>
          </div>
        </div>
      </section>
      <section style={{ padding: "40px 20px 52px", background: "linear-gradient(170deg, #1F354C 0%, #2E6F7E 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -1, left: 0, right: 0, height: 50, background: C.cream, maskImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 430 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L430 0 L430 25 Q380 50 320 20 Q260 -5 200 25 Q140 50 80 20 Q30 -5 0 25Z' fill='black'/%3E%3C/svg%3E")`, WebkitMaskImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 430 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L430 0 L430 25 Q380 50 320 20 Q260 -5 200 25 Q140 50 80 20 Q30 -5 0 25Z' fill='black'/%3E%3C/svg%3E")`, maskSize: "cover", WebkitMaskSize: "cover" }} />
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.06 }} viewBox="0 0 430 200" preserveAspectRatio="none"><path d="M-50 100 C50 70 150 130 250 80 S400 50 530 100" stroke="white" strokeWidth="40" strokeLinecap="round" fill="none" /></svg>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 380, margin: "0 auto" }}>
          <div style={{ marginBottom: 12 }}><WPing mood="happy" size={44} style={{ margin: "0 auto" }} /></div>
          <Logo variant="text" size={32} dark style={{ justifyContent: "center", marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontStyle: "italic", marginBottom: 28 }}>Jouw perfecte sessie, onze obsessie</div>
          <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 32px", background: C.terra, color: "#FFF", fontWeight: 700, fontSize: 15, borderRadius: 12, textDecoration: "none", boxShadow: "0 4px 20px rgba(201,122,99,0.3)" }}>Gratis aanmelden <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></Link>
          <div style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Al een account? <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontWeight: 600 }}>Log in</Link></div>
        </div>
      </section>
      <footer style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "24px 20px", background: C.cream }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo variant="icon" size={20} /><span style={{ fontSize: 11, color: C.sub }}>© 2026 WindPing</span></div>
          <nav style={{ display: "flex", gap: 20 }}>
            <Link href="/spot-select" style={{ fontSize: 12, color: C.sub, textDecoration: "none" }}>Spots</Link>
            <Link href="/login" style={{ fontSize: 12, color: C.sub, textDecoration: "none" }}>Log in</Link>
            <Link href="/signup" style={{ fontSize: 12, color: C.sky, textDecoration: "none", fontWeight: 600 }}>Aanmelden</Link>
          </nav>
        </div>
      </footer>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes scrollPulse{0%,100%{opacity:0.3;transform:scaleY(1)}50%{opacity:0.8;transform:scaleY(1.3)}}`}</style>
    </main>
  );
}

export default function HomePage() {
  const [view, setView] = useState<"loading" | "landing" | "dashboard">("loading");
  useEffect(() => {
    const email = getEmail();
    setView(email && !isTokenExpired() ? "dashboard" : "landing");
  }, []);
  if (view === "loading") return (<div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Logo variant="icon" size={48} animated /></div>);
  if (view === "dashboard") return <Dashboard />;
  return <LandingPage />;
}