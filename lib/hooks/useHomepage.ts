/* ── lib/hooks/useHomepage.ts ─────────────────────────────
   Data fetching hook voor de homepage Dashboard component.
   Bevat alle state, data fetching en handlers.
   Dashboard zelf wordt een pure render component.
──────────────────────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { getEmail, getAuthId, getValidToken, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { bundleAlertsByDate, BundledFeedItem } from "@/lib/utils/feedUtils";
import { SessionStats, RecentSession } from "@/app/components/SessionStatsSection";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpotSummary {
  id: number;
  name: string;
  ws: number;
  wd: number;
  match: "go" | "maybe" | "no";
}

// ── Helpers (local to this hook) ─────────────────────────────────────────────

const OM_BASE = "https://api.open-meteo.com/v1/forecast";
const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

function degToDir(deg: number) {
  return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHomepage() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [pauseUntil, setPauseUntil] = useState("");
  const [pauseOption, setPauseOption] = useState<"24h" | "48h" | "1w" | "2w" | "custom">("24h");
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total_sessions: 0, total_spots: 0, current_streak: 0, longest_streak: 0,
    avg_rating: null, favorite_spot_id: null, last_session_date: null, season_sessions: 0, badges: [],
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [spotNames, setSpotNames] = useState<Record<number, string>>({});
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [friendActivity, setFriendActivity] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [allSpots, setAllSpots] = useState<{id: number; name: string; lat: number; lng: number}[]>([]);
  const [allPublicSpots, setAllPublicSpots] = useState<{id: number; name: string; lat: number; lng: number}[]>([]);
  const [homeSpotId, setHomeSpotId] = useState<number | null>(null);
  const [homeSpotName, setHomeSpotName] = useState<string>("");
  const [homeSpotPosts, setHomeSpotPosts] = useState<any[]>([]);
  const [goingSessions, setGoingSessions] = useState<Record<string, any>>({});

  const loadData = useCallback(async () => {
    try {
      const email = getEmail();
      if (!email) return;
      const authId = getAuthId();
      const users = await sbGet(`users?auth_id=eq.${encodeURIComponent(authId || "")}&select=id,name,min_wind_speed,max_wind_speed,welcome_shown,home_spot_id`);
      if (!users?.length) return;
      const user = users[0];
      setUserName(user.name || email.split("@")[0]);
      setUserId(user.id);

      if (!user.welcome_shown) {
        setShowWelcome(true);
        sbPatch(`users?id=eq.${user.id}`, { welcome_shown: true }).catch(() => {});
      }

      try {
        const pauseData = await sbGet(`user_settings?user_id=eq.${user.id}&select=alerts_paused_until`);
        if (pauseData?.[0]?.alerts_paused_until) {
          const until = new Date(pauseData[0].alerts_paused_until);
          if (until > new Date()) {
            setPaused(true);
            setPauseUntil(until.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }));
          }
        }
      } catch {}

      const userSpots = await sbGet(`user_spots?user_id=eq.${user.id}&select=spot_id`);

      try {
        const prefs = await sbGet(`alert_preferences?user_id=eq.${user.id}&select=id`);
        const needsOnboarding = !user.name || !userSpots?.length || !prefs?.length;
        if (needsOnboarding) { window.location.href = "/onboarding"; return; }
      } catch {}

      if (!userSpots?.length) { setLoading(false); return; }
      const ids = userSpots.map((x: any) => x.spot_id);

      // Auto-set homespot
      let currentHomeSpotId = user.home_spot_id || null;
      if (!currentHomeSpotId && ids.length >= 1) {
        currentHomeSpotId = ids[0];
        try { await sbPatch(`users?id=eq.${user.id}`, { home_spot_id: currentHomeSpotId }); } catch {}
      }
      if (currentHomeSpotId) {
        setHomeSpotId(currentHomeSpotId);
        try {
          const posts = await sbGet(`spot_posts?spot_id=eq.${currentHomeSpotId}&order=created_at.desc&limit=3&select=id,type,content,author_name,created_at,wind_speed,wind_dir`);
          setHomeSpotPosts(posts || []);
          const spotInfo = await sbGet(`spots?id=eq.${currentHomeSpotId}&select=display_name`);
          if (spotInfo?.[0]) setHomeSpotName(spotInfo[0].display_name);
        } catch {}
      }

      const [spotsData, condsData] = await Promise.all([
        sbGet(`spots?id=in.(${ids.join(",")})&select=id,display_name,latitude,longitude,good_directions`),
        sbGet(`ideal_conditions?user_id=eq.${user.id}&spot_id=in.(${ids.join(",")})&select=spot_id,wind_min,wind_max,directions`),
      ]);

      const names: Record<number, string> = {};
      (spotsData || []).forEach((s: any) => { names[s.id] = s.display_name; });

      try {
        const sessRes2 = await sbGet(`sessions?created_by=eq.${user.id}&order=id.desc&limit=10&select=spot_id`);
        const sessionSpotIds = (sessRes2 || []).map((s: any) => s.spot_id).filter((id: number) => !names[id]);
        if (sessionSpotIds.length > 0) {
          const extraSpots = await sbGet(`spots?id=in.(${sessionSpotIds.join(",")})&select=id,display_name`);
          (extraSpots || []).forEach((s: any) => { names[s.id] = s.display_name; });
        }
      } catch {}

      setSpotNames(names);
      setAllSpots((spotsData || []).filter((s: any) => s.latitude && s.longitude).map((s: any) => ({
        id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude,
      })));

      try {
        const publicSpots = await sbGet(`spots?select=id,display_name,latitude,longitude&order=display_name.asc`);
        setAllPublicSpots((publicSpots || []).filter((s: any) => s.latitude && s.longitude).map((s: any) => ({
          id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude,
        })));
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleIkGa = async (spotName: string, spotId?: number, date?: string, wind?: number, gust?: number, dir?: string) => {
    if (!spotId || !date || !userId) return;
    const key = `${spotId}_${date}`;
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ created_by: userId, spot_id: spotId, session_date: date, status: "going", going_at: new Date().toISOString(), forecast_wind: wind || 0, forecast_gust: gust || 0, forecast_dir: dir || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoingSessions(prev => ({ ...prev, [key]: data[0] || data }));
      }
    } catch (e) { console.error("Ik ga error:", e); }
  };

  const handleSkipHome = async (spotId: number, date: string) => {
    const key = `${spotId}_${date}`;
    const session = goingSessions[key];
    if (!session) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      setGoingSessions(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch {}
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const goSpots = spots.filter(s => s.match === "go");
  const feedItems = bundleAlertsByDate(recentAlerts);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";

  return {
    // state
    userName, userId, spots, loading,
    paused, setPaused, showPause, setShowPause, pauseUntil, setPauseUntil,
    pauseOption, setPauseOption,
    recentAlerts, sessionStats, recentSessions, spotNames, earnedBadges,
    friendActivity, showWelcome, allSpots, allPublicSpots,
    homeSpotId, homeSpotName, homeSpotPosts, setHomeSpotPosts,
    goingSessions,
    // computed
    goSpots, feedItems, greeting,
    // handlers
    loadData, handleIkGa, handleSkipHome,
  };
}
