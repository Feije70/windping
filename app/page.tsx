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
  forecast_wind: number | null;
  forecast_dir: string | null;
  gear_size: string | null;
  wind_feel: string | null;
  image_url: string | null;
  spots?: { display_name: string };
}

function SessionStatsSection({ stats, sessions, spotNames }: { stats: SessionStats; sessions: RecentSession[]; spotNames: Record<number, string> }) {
  const completed = sessions.filter(s => s.status === "completed");
  const hasData = stats.total_sessions > 0 || completed.length > 0;

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
      {completed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {completed.slice(0, 3).map((s) => {
            const dObj = new Date(s.session_date + "T12:00:00");
            const now = new Date();
            const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetD = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
            const diff = Math.round((targetD.getTime() - todayD.getTime()) / 86400000);
            const dateLabel = diff === 0 ? "Vandaag" : diff === -1 ? "Gisteren" : dObj.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
            const spotName = spotNames[s.spot_id] || "Spot";
            const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
            const ratingColors: Record<number, string> = { 1: "#C97A63", 2: C.amber, 3: C.gold, 4: C.sky, 5: C.green };
            const windFeelLabel: Record<string, string> = { perfect: "Perfect", overpowered: "Te veel", underpowered: "Te weinig", gusty: "Gusty" };
            const borderColor = s.rating ? ratingColors[s.rating] : C.cardBorder;
            return (
              <div key={s.id} style={{ background: C.card, borderLeft: `3px solid ${borderColor}`, borderRadius: 13, boxShadow: C.cardShadow, overflow: "hidden" }}>
                {s.image_url && (
                  <img src={s.image_url} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                )}
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{spotName}</div>
                      <div style={{ fontSize: 11, color: C.sub }}>{dateLabel}{s.forecast_wind ? ` · ${s.forecast_wind}kn ${s.forecast_dir || ""}` : ""}</div>
                    </div>
                    {s.rating && (
                      <div style={{ fontSize: 13, fontWeight: 800, color: ratingColors[s.rating] }}>{ratingLabels[s.rating]}</div>
                    )}
                  </div>
                  {(s.gear_type || s.gear_size || s.wind_feel) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {s.gear_type && (() => {
                        // Handle legacy JSON strings like ["kite"] or {"kite":"9"}
                        let gt = s.gear_type;
                        try { const p = JSON.parse(gt); gt = Array.isArray(p) ? p[0] : typeof p === "object" ? Object.keys(p)[0] : gt; } catch {}
                        return <span style={{ fontSize: 11, color: C.sub, background: C.cream, padding: "2px 8px", borderRadius: 6 }}>{gt.replace("-", " ")}</span>;
                      })()}
                      {s.gear_size && !s.gear_size.startsWith("{") && <span style={{ fontSize: 11, color: C.sub }}>{s.gear_size}</span>}
                      {s.wind_feel && <span style={{ fontSize: 11, color: C.muted }}>· {windFeelLabel[s.wind_feel] || s.wind_feel}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

  const goSpots = spots.filter(s => s.match === "go");
  const matchColors: Record<string, string> = { go: C.green, maybe: C.gold, no: C.amber };

  const loadData = useCallback(async () => {
    try {
      const email = getEmail();
      if (!email) return;
      const authId = getAuthId();
      const users = await sbGet(`users?auth_id=eq.${encodeURIComponent(authId || "")}&select=id,name,min_wind_speed,max_wind_speed`);
      if (!users?.length) return;
      const user = users[0];
      setUserName(user.name || email.split("@")[0]);
      setUserId(user.id);
      try {
        const pauseData = await sbGet(`user_settings?user_id=eq.${user.id}&select=alerts_paused_until`);
        if (pauseData?.[0]?.alerts_paused_until) {
          const until = new Date(pauseData[0].alerts_paused_until);
          if (until > new Date()) { setPaused(true); setPauseUntil(until.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })); }
        }
      } catch {}
      const userSpots = await sbGet(`user_spots?user_id=eq.${user.id}&select=spot_id`);
      if (!userSpots?.length) { setLoading(false); return; }
      const ids = userSpots.map((x: any) => x.spot_id);
      const [spotsData, condsData] = await Promise.all([
        sbGet(`spots?id=in.(${ids.join(",")})&select=id,display_name,latitude,longitude,good_directions`),
        sbGet(`ideal_conditions?user_id=eq.${user.id}&spot_id=in.(${ids.join(",")})&select=spot_id,wind_min,wind_max,directions`),
      ]);
      const names: Record<number, string> = {};
      (spotsData || []).forEach((s: any) => { names[s.id] = s.display_name; });
      setSpotNames(names);
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
          const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${user.id}&status=eq.completed&order=id.desc&limit=10&select=id,spot_id,session_date,status,rating,gear_type,gear_size,wind_feel,image_url,forecast_wind,forecast_dir`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          if (sessRes.ok) {
            const sessData = await sessRes.json() || [];
            setRecentSessions(sessData);
            // Fetch spot names for session spots not yet in spotNames
            const sessionSpotIds = [...new Set(sessData.map((s: any) => s.spot_id))] as number[];
            if (sessionSpotIds.length > 0) {
              try {
                const extraSpotsRes = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=in.(${sessionSpotIds.join(",")})&select=id,display_name`, {
                  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
                });
                if (extraSpotsRes.ok) {
                  const extraSpots = await extraSpotsRes.json();
                  setSpotNames(prev => {
                    const updated = { ...prev };
                    (extraSpots || []).forEach((s: any) => { updated[s.id] = s.display_name; });
                    return updated;
                  });
                }
              } catch {}
            }
          }
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
  const feedItems = bundleAlertsByDate(recentAlerts);

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
            const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
            const ratingColors: Record<number, string> = { 1: "#C97A63", 2: C.amber, 3: C.gold, 4: C.sky, 5: C.green };
            const isCompleted = a.status === "completed";
            const borderColor = isCompleted && a.rating ? ratingColors[a.rating] : C.sky;
            return (
              <div key={a.id} style={{ background: C.card, borderLeft: `3px solid ${borderColor}`, borderRadius: 13, boxShadow: C.cardShadow, marginBottom: 10, overflow: "hidden" }}>
                {/* Photo */}
                {isCompleted && a.imageUrl && (
                  <img src={a.imageUrl} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                )}
                <div style={{ padding: "12px 16px" }}>
                  {/* Top row: avatar + name + time */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isCompleted && (a.gearType || a.rating) ? 8 : 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.oceanTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.sky, flexShrink: 0 }}>
                      {a.friendName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.4 }}>
                        <strong style={{ color: C.navy }}>{a.friendName}</strong>
                        {isCompleted ? " was op " : " gaat naar "}
                        <strong style={{ color: C.sky }}>{a.spotName}</strong>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{timeAgo}</div>
                  </div>
                  {/* Session details for completed */}
                  {isCompleted && (a.rating || a.gearType || a.gearSize || a.windFeel) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingLeft: 44 }}>
                      {a.rating && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: ratingColors[a.rating] }}>
                          {ratingLabels[a.rating]}
                        </span>
                      )}
                      {a.gearType && (
                        <span style={{ fontSize: 11, color: C.sub, background: C.cream, padding: "2px 8px", borderRadius: 6 }}>
                          {a.gearType.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}
                        </span>
                      )}
                      {a.gearSize && !a.gearSize.startsWith("{") && (
                        <span style={{ fontSize: 11, color: C.sub }}>
                          {a.gearSize}
                        </span>
                      )}
                      {a.windFeel && (
                        <span style={{ fontSize: 11, color: C.muted }}>
                          · {a.windFeel === "perfect" ? "Perfect" : a.windFeel === "overpowered" ? "Te veel" : a.windFeel === "underpowered" ? "Te weinig" : "Gusty"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* W. Ping message */}
          <div style={{ padding: "13px 16px", background: C.oceanTint, borderRadius: 13, border: "1px solid rgba(46,111,126,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}><WPing mood={goSpots.length > 0 ? "happy" : "sleep"} size={22} /></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>W. Ping</div>
              <div style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>nu</div>
            </div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              {spots.length === 0 ? "Welkom bij WindPing! Voeg je favoriete spots toe en ik houd de wind voor je in de gaten." : goSpots.length > 0 ? `Yes! ${goSpots.length > 1 ? `${goSpots.length} spots zijn` : `${goSpots[0].name} is`} Go vandaag. Tas al ingepakt?` : "Vandaag even geen wind op je spots. Ik houd het in de gaten!"}
              {friendActivity.length === 0 && spots.length > 0 && (
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
            {sessionStats.total_sessions > 0 && <span style={{ fontSize: 11, color: C.sub }}>Seizoen: {sessionStats.season_sessions}</span>}
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
            <Link href="/spots" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", background: C.oceanTint, color: C.sky, fontWeight: 600, fontSize: 13, borderRadius: 12, textDecoration: "none" }}>{Icons.search({ color: C.sky })} Bekijk spots</Link>
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
            <Link href="/spots" style={{ fontSize: 12, color: C.sub, textDecoration: "none" }}>Spots</Link>
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