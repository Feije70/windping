/* ── lib/hooks/useHomepage.ts ─────────────────────────────────
   Data fetching hook voor de homepage Dashboard component.
   Gebruikt lib/db/ voor alle Supabase queries.
──────────────────────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { bundleAlertsByDate, BundledFeedItem } from "@/lib/utils/feedUtils";
import { SessionStats, RecentSession } from "@/app/components/SessionStatsSection";
import {
  getUserByAuthId,
  updateUser,
  getAlertPausedUntil,
  needsOnboarding,
  getUserSpotIds,
  getSpotsByIds,
  getSpotNames,
  getAllPublicSpots,
  getIdealConditions,
  getSpotPosts,
  getRecentAlertHistory,
  getUserSessions,
  getUserStats,
  createGoingSession,
  deleteSession,
} from "@/lib/db";
import type {
  DbUser,
  DbSpot,
  DbIdealConditions,
  DbSession,
  DbAlertHistory,
  DbSpotPost,
  FriendActivityItem,
  SessionGoingRequest,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpotSummary {
  id: number;
  name: string;
  ws: number;
  wd: number;
  match: "go" | "maybe" | "no";
}

interface MapSpot {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OM_BASE = "https://api.open-meteo.com/v1/forecast";
const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"] as const;

function degToDir(deg: number): string {
  return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHomepage() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [pauseUntil, setPauseUntil] = useState("");
  const [pauseOption, setPauseOption] = useState<"24h" | "48h" | "1w" | "2w" | "custom">("24h");
  const [recentAlerts, setRecentAlerts] = useState<DbAlertHistory[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    total_sessions: 0, total_spots: 0, current_streak: 0, longest_streak: 0,
    avg_rating: null, favorite_spot_id: null, last_session_date: null, season_sessions: 0, badges: [],
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [spotNames, setSpotNames] = useState<Record<number, string>>({});
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [friendActivity, setFriendActivity] = useState<FriendActivityItem[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [allSpots, setAllSpots] = useState<MapSpot[]>([]);
  const [allPublicSpots, setAllPublicSpots] = useState<MapSpot[]>([]);
  const [homeSpotId, setHomeSpotId] = useState<number | null>(null);
  const [homeSpotName, setHomeSpotName] = useState<string>("");
  const [homeSpotPosts, setHomeSpotPosts] = useState<DbSpotPost[]>([]);
  const [goingSessions, setGoingSessions] = useState<Record<string, DbSession>>({});

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return;
      const authId = session?.user?.id;
      const token = session?.access_token;
      if (!authId || !token) return;

      // 1. User laden
      const user = await getUserByAuthId(authId, token);
      if (!user) return;
      setUserName(user.name || email.split("@")[0]);
      setUserId(user.id);

      if (!user.welcome_shown) {
        setShowWelcome(true);
        updateUser(user.id, { welcome_shown: true } as Partial<DbUser>, token).catch(() => {});
      }

      // 2. Alerts gepauzeerd?
      try {
        const pausedUntil = await getAlertPausedUntil(user.id, token);
        if (pausedUntil) {
          const until = new Date(pausedUntil);
          if (until > new Date()) {
            setPaused(true);
            setPauseUntil(until.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }));
          }
        }
      } catch {}

      // 3. User spots laden
      const spotIds = await getUserSpotIds(user.id, token);

      // 4. Onboarding check
      try {
        const onboarding = await needsOnboarding(user.id, user.name, token);
        if (onboarding) { window.location.href = "/onboarding"; return; }
      } catch {}

      if (!spotIds.length) { setLoading(false); return; }

      // 5. Home spot instellen
      let currentHomeSpotId = user.home_spot_id ?? null;
      if (!currentHomeSpotId && spotIds.length >= 1) {
        currentHomeSpotId = spotIds[0];
        try { await updateUser(user.id, { home_spot_id: currentHomeSpotId } as Partial<DbUser>, token); } catch {}
      }
      if (currentHomeSpotId) {
        setHomeSpotId(currentHomeSpotId);
        try {
          const [posts, spotInfo] = await Promise.all([
            getSpotPosts(currentHomeSpotId, 3),
            getSpotsByIds([currentHomeSpotId], token),
          ]);
          setHomeSpotPosts(posts);
          if (spotInfo[0]) setHomeSpotName(spotInfo[0].display_name);
        } catch {}
      }

      // 6. Spots + ideal conditions parallel laden
      type SpotWithCoords = Pick<DbSpot, "id" | "display_name" | "latitude" | "longitude" | "good_directions">;
      type IcForSpot = Pick<DbIdealConditions, "spot_id" | "wind_min" | "wind_max" | "directions">;

      const [spotsData, condsData] = await Promise.all([
        getSpotsByIds(spotIds, token) as Promise<SpotWithCoords[]>,
        getIdealConditions(user.id, spotIds, token) as Promise<IcForSpot[]>,
      ]);

      // 7. Spot namen opbouwen
      const names: Record<number, string> = {};
      (spotsData ?? []).forEach((s) => { names[s.id] = s.display_name; });

      try {
        const sessions = await getUserSessions(user.id, token, 10);
        const missingIds = sessions.map((s) => s.spot_id).filter((id) => !names[id]);
        if (missingIds.length > 0) {
          const extra = await getSpotNames(missingIds, token);
          Object.assign(names, extra);
        }
      } catch {}

      setSpotNames(names);
      setAllSpots(
        (spotsData ?? [])
          .filter((s) => s.latitude && s.longitude)
          .map((s) => ({ id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude }))
      );

      try {
        const publicSpots = await getAllPublicSpots(token);
        setAllPublicSpots(
          publicSpots
            .filter((s) => s.latitude && s.longitude)
            .map((s) => ({ id: s.id, name: s.display_name, lat: s.latitude, lng: s.longitude }))
        );
      } catch {}

      // 8. Wind data ophalen per spot
      const conds: Record<number, IcForSpot> = {};
      (condsData ?? []).forEach((ic) => { conds[ic.spot_id] = ic; });
      const valid = (spotsData ?? []).filter((s) => s.latitude && s.longitude);
      const results: SpotSummary[] = [];

      await Promise.all(valid.map(async (s) => {
        try {
          const res = await fetch(
            `${OM_BASE}?latitude=${s.latitude}&longitude=${s.longitude}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=auto`
          );
          const w: { current: { wind_speed_10m: number; wind_direction_10m: number } } = await res.json();
          const ws = Math.round(w.current?.wind_speed_10m || 0);
          const wd = w.current?.wind_direction_10m || 0;
          const ic = conds[s.id];
          const wMin = ic?.wind_min ?? 15;
          const wMax = ic?.wind_max ?? 25;
          const dirs: string[] = (ic?.directions?.length ? ic.directions : (s.good_directions || [])) as string[];
          const dirOk = dirs.length === 0 || dirs.includes(degToDir(wd));
          const speedOk = ws >= wMin && ws <= wMax;
          results.push({
            id: s.id,
            name: s.display_name,
            ws,
            wd,
            match: speedOk && dirOk ? "go" : speedOk || dirOk ? "maybe" : "no",
          });
        } catch {}
      }));

      results.sort((a, b) => {
        const o: Record<SpotSummary["match"], number> = { go: 0, maybe: 1, no: 2 };
        return o[a.match] - o[b.match];
      });
      setSpots(results);

      // 9. Recente alerts
      try {
        const alertData = await getRecentAlertHistory(user.id, 7, token);
        setRecentAlerts(alertData);
      } catch {}

      // 10. Sessies + stats
      try {
        const [sessData, statsData] = await Promise.all([
          getUserSessions(user.id, token, 10),
          getUserStats(user.id, token),
        ]);
        setRecentSessions(sessData as RecentSession[]);
        if (statsData) {
          const badges: string[] = typeof statsData.badges === "string"
            ? JSON.parse(statsData.badges)
            : (statsData.badges || []);
          setSessionStats({ ...statsData, badges });
          setEarnedBadges(badges);
        }
      } catch (e) { console.error("Session stats load error:", e); }

      // 11. Vriend activiteit
      try {
        const actRes = await fetch("/api/friends?type=activity", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (actRes.ok) {
          const actData: { activity: FriendActivityItem[] } = await actRes.json();
          setFriendActivity(actData.activity || []);
        }
      } catch (e) { console.error("Friend activity load error:", e); }

    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleIkGa = async (
    spotName: string,
    spotId?: number,
    date?: string,
    wind?: number,
    gust?: number,
    dir?: string
  ) => {
    if (!spotId || !date || !userId) return;
    const key = `${spotId}_${date}`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    try {
      const request: SessionGoingRequest = {
        created_by: userId,
        spot_id: spotId,
        session_date: date,
        status: "going",
        going_at: new Date().toISOString(),
        forecast_wind: wind || 0,
        forecast_gust: gust || 0,
        forecast_dir: dir || "",
      };
      const newSession = await createGoingSession(request, token);
      setGoingSessions((prev) => ({ ...prev, [key]: newSession }));
    } catch (e) { console.error("Ik ga error:", e); }
  };

  const handleSkipHome = async (spotId: number, date: string) => {
    const key = `${spotId}_${date}`;
    const session = goingSessions[key];
    if (!session) return;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) return;
    try {
      await deleteSession(session.id, token);
      setGoingSessions((prev) => { const next = { ...prev }; delete next[key]; return next; });
    } catch {}
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const goSpots = spots.filter((s) => s.match === "go");
  const feedItems: BundledFeedItem[] = bundleAlertsByDate(recentAlerts);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";

  return {
    userName, userId, spots, loading,
    paused, setPaused, showPause, setShowPause, pauseUntil, setPauseUntil,
    pauseOption, setPauseOption,
    recentAlerts, sessionStats, recentSessions, spotNames, earnedBadges,
    friendActivity, showWelcome, allSpots, allPublicSpots,
    homeSpotId, homeSpotName, homeSpotPosts, setHomeSpotPosts,
    goingSessions,
    goSpots, feedItems, greeting,
    loadData, handleIkGa, handleSkipHome,
  };
}