/* ── app/api/admin/stats/route.ts ──────────────────────────
   Admin Statistics Endpoint
   Returns platform-wide stats: users, sessions, spots, reactions
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isAdmin(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const adminIds = (process.env.ADMIN_AUTH_IDS || "").split(",").map(s => s.trim());
    return adminIds.includes(payload.sub);
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!isAdmin(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    { data: users },
    { data: sessions },
    { data: spots },
    { data: reactions },
    { data: friendships },
    { data: recentSessions },
    { data: spotSessions },
  ] = await Promise.all([
    sb.from("users").select("id, name, email, created_at"),
    sb.from("sessions").select("id, status, session_date, spot_id, rating, created_by"),
    sb.from("spots").select("id, display_name"),
    sb.from("session_reactions").select("id, reaction, session_id, created_at"),
    sb.from("friendships").select("id, status"),
    sb.from("sessions").select("id, created_by, session_date, status").gte("session_date", sevenDaysAgo),
    sb.from("sessions")
      .select("spot_id, status, spots(display_name)")
      .eq("status", "completed"),
  ]);

  // Users over time (by month)
  const usersByMonth: Record<string, number> = {};
  (users || []).forEach(u => {
    const month = u.created_at?.substring(0, 7) || "unknown";
    usersByMonth[month] = (usersByMonth[month] || 0) + 1;
  });

  // Sessions by status
  const allSessions = sessions || [];
  const completed = allSessions.filter(s => s.status === "completed");
  const going = allSessions.filter(s => s.status === "going");

  // Sessions per spot
  const sessionsPerSpot: Record<number, { name: string; count: number; avgRating: number | null }> = {};
  (spotSessions || []).forEach((s: any) => {
    const id = s.spot_id;
    const name = s.spots?.display_name || `Spot #${id}`;
    if (!sessionsPerSpot[id]) sessionsPerSpot[id] = { name, count: 0, avgRating: null };
    sessionsPerSpot[id].count++;
  });

  // Avg rating per spot
  const ratingsBySpot: Record<number, number[]> = {};
  completed.forEach(s => {
    if (s.rating && s.spot_id) {
      if (!ratingsBySpot[s.spot_id]) ratingsBySpot[s.spot_id] = [];
      ratingsBySpot[s.spot_id].push(s.rating);
    }
  });
  Object.entries(ratingsBySpot).forEach(([spotId, ratings]) => {
    const id = Number(spotId);
    if (sessionsPerSpot[id]) {
      sessionsPerSpot[id].avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    }
  });

  const topSpots = Object.entries(sessionsPerSpot)
    .map(([id, data]) => ({ id: Number(id), ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Reactions breakdown
  const allReactions = reactions || [];
  const reactionCounts: Record<string, number> = {};
  allReactions.forEach(r => {
    reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
  });

  // Active users (logged session in last 30 days)
  const activeUserIds = new Set(
    allSessions
      .filter(s => s.session_date >= thirtyDaysAgo)
      .map(s => s.created_by)
  );

  // Sessions per day (last 14 days)
  const sessionsByDay: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    sessionsByDay[d.toISOString().split("T")[0]] = 0;
  }
  (recentSessions || []).forEach(s => {
    if (sessionsByDay.hasOwnProperty(s.session_date)) {
      sessionsByDay[s.session_date]++;
    }
  });

  // Rating distribution
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  completed.forEach(s => { if (s.rating) ratingDist[s.rating]++; });

  // Most active loggers
  const sessionsByUser: Record<number, number> = {};
  allSessions.forEach(s => {
    sessionsByUser[s.created_by] = (sessionsByUser[s.created_by] || 0) + 1;
  });
  const topUsers = Object.entries(sessionsByUser)
    .map(([userId, count]) => {
      const user = (users || []).find(u => u.id === Number(userId));
      return { id: Number(userId), name: user?.name || user?.email?.split("@")[0] || "?", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json({
    overview: {
      totalUsers: (users || []).length,
      activeUsers30d: activeUserIds.size,
      totalSessions: allSessions.length,
      completedSessions: completed.length,
      goingSessions: going.length,
      totalSpots: (spots || []).length,
      totalReactions: allReactions.length,
      totalFriendships: (friendships || []).filter(f => f.status === "accepted").length,
      sessionsLast7d: (recentSessions || []).length,
      avgRating: completed.filter(s => s.rating).length > 0
        ? Math.round((completed.filter(s => s.rating).reduce((a, s) => a + (s.rating || 0), 0) / completed.filter(s => s.rating).length) * 10) / 10
        : null,
    },
    topSpots,
    reactionCounts,
    sessionsByDay,
    ratingDist,
    topUsers,
    usersByMonth,
  });
}