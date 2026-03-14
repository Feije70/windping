/* ── app/api/sessions/route.ts ─────────────────────────────
   WindPing Session API
   
   POST   - Create "Ik ga!" or complete a session
   GET    - Fetch user sessions + stats
   PATCH  - Update session (complete, skip, edit)
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { DbSession, SessionStatus } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ── Auth helper ── */
async function getUserId(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  
  const supabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  
  const { data } = await sb().from("users").select("id").eq("auth_id", user.id).single();
  return data?.id || null;
}

/* ── Lokale types voor badge + stats berekeningen ── */
interface SessionRow {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_size: number | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  going_at: string | null;
  completed_at: string | null;
}

interface StatsResult {
  total_sessions: number;
  total_spots: number;
  current_streak: number;
  longest_streak: number;
  avg_rating: number | null;
  favorite_spot_id: number | null;
  favorite_gear_size: string | null;
  last_session_date: string | null;
  season_sessions: number;
}

/* ── Badge calculation ── */
const BADGE_DEFINITIONS: {
  id: string;
  name: string;
  check: (sessions: SessionRow[], stats?: StatsResult) => boolean;
}[] = [
  { id: "early_bird", name: "Vroege Vogel", check: (sessions) => sessions.some(s => s.going_at && new Date(s.going_at).getHours() < 9) },
  { id: "storm_chaser", name: "Stormjager", check: (sessions) => sessions.some(s => (s.forecast_wind || 0) >= 30) },
  { id: "local_hero", name: "Local Hero", check: (sessions) => {
    const spotCounts: Record<number, number> = {};
    sessions.filter(s => s.status === "completed").forEach(s => { spotCounts[s.spot_id] = (spotCounts[s.spot_id] || 0) + 1; });
    return Object.values(spotCounts).some(c => c >= 10);
  }},
  { id: "call_in_sick", name: "Ziek Gemeld", check: (sessions) => sessions.some(s => {
    const day = new Date(s.session_date + "T12:00:00").getDay();
    return s.status === "completed" && day >= 1 && day <= 5;
  })},
  { id: "streak_5", name: "5x Streak", check: (_s, stats) => (stats?.longest_streak || 0) >= 5 },
  { id: "explorer", name: "Ontdekker", check: (_s, stats) => (stats?.total_spots || 0) >= 5 },
  { id: "tide_master", name: "Getij Meester", check: (sessions) => sessions.filter(s => s.status === "completed" && (s.rating || 0) >= 4).length >= 10 },
  { id: "night_rider", name: "Avondrijder", check: (sessions) => sessions.some(s => s.completed_at && new Date(s.completed_at).getHours() >= 18) },
];

function calculateBadges(sessions: SessionRow[], stats: StatsResult): string[] {
  return BADGE_DEFINITIONS.filter(b => b.check(sessions, stats)).map(b => b.id);
}

/* ── Stats calculation ── */
function calculateStats(sessions: SessionRow[]): StatsResult {
  const completed = sessions.filter(s => s.status === "completed");
  const uniqueSpots = new Set(completed.map(s => s.spot_id));
  
  // Streak: consecutive weeks with at least one session
  const weekSet = new Set<string>();
  completed.forEach(s => {
    const d = new Date(s.session_date + "T12:00:00");
    const year = d.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    weekSet.add(`${year}-W${week}`);
  });
  
  const sortedWeeks = Array.from(weekSet).sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  
  // Simple week-number streak calc
  for (let i = 0; i < sortedWeeks.length; i++) {
    if (i === 0) { streak = 1; continue; }
    const [prevY, prevW] = sortedWeeks[i - 1].split("-W").map(Number);
    const [curY, curW] = sortedWeeks[i].split("-W").map(Number);
    if ((prevY === curY && prevW - curW === 1) || (prevY - curY === 1 && prevW === 1 && curW >= 51)) {
      streak++;
    } else {
      if (i === 1) currentStreak = streak; // first break = current streak end
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak);
  if (sortedWeeks.length <= streak) currentStreak = streak;
  if (currentStreak === 0 && sortedWeeks.length > 0) currentStreak = 1;
  
  // Favorite spot
  const spotCounts: Record<number, number> = {};
  completed.forEach(s => { spotCounts[s.spot_id] = (spotCounts[s.spot_id] || 0) + 1; });
  const favoriteSpotId = Object.entries(spotCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  
  // Average rating
  const rated = completed.filter(s => s.rating);
  const avgRating = rated.length > 0 ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length : null;
  
  // Season sessions (March-October of current year)
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 2, 1); // March
  const seasonEnd = new Date(now.getFullYear(), 10, 1); // November
  const seasonSessions = completed.filter(s => {
    const d = new Date(s.session_date);
    return d >= seasonStart && d < seasonEnd;
  }).length;
  
  // Last session
  const sorted = [...completed].sort((a, b) => b.session_date.localeCompare(a.session_date));
  
  // Favorite gear
  const gearCounts: Record<string, number> = {};
  completed.filter(s => s.gear_size).forEach(s => { gearCounts[String(s.gear_size)] = (gearCounts[String(s.gear_size)] || 0) + 1; });
  const favoriteGear = Object.entries(gearCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  
  return {
    total_sessions: completed.length,
    total_spots: uniqueSpots.size,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    favorite_spot_id: favoriteSpotId ? parseInt(favoriteSpotId) : null,
    favorite_gear_size: favoriteGear,
    last_session_date: sorted[0]?.session_date || null,
    season_sessions: seasonSessions,
  };
}

/* ── Notify friends when session is completed ── */
async function notifyFriendsSessionCompleted(
  supabase: ReturnType<typeof sb>,
  userId: number,
  sessionId: number
) {
  try {
    // Get session + spot name
    interface NotifySession {
      spot_id: number;
      forecast_wind: number | null;
      forecast_dir: string | null;
      rating: number | null;
      spots: { display_name: string } | null;
    }
    const { data: sessionRaw } = await supabase
      .from("sessions")
      .select("spot_id, forecast_wind, forecast_dir, rating, spots(display_name)")
      .eq("id", sessionId)
      .single();
    const session = sessionRaw as NotifySession | null;
    if (!session) return;

    // Get user name
    const { data: userRaw } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();
    const userName = (userRaw as { name: string } | null)?.name || "Iemand";

    // Get friend ids
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");
    if (!friendships?.length) return;

    const friendIds = (friendships as { user_id: number; friend_id: number }[])
      .map(f => f.user_id === userId ? f.friend_id : f.user_id);

    const spotName = session.spots?.display_name || "een spot";
    const wind = session.forecast_wind ? ` · ${session.forecast_wind}kn` : "";
    const ratingEmojis: Record<number, string> = { 1: "😬", 2: "😐", 3: "👌", 4: "😎", 5: "🤙" };
    const emoji = session.rating ? ratingEmojis[session.rating] || "🏄" : "🏄";

    const title = `${emoji} ${userName} was op ${spotName}`;
    const message = `${spotName}${wind}${session.forecast_dir ? " " + session.forecast_dir : ""}`;
    const url = `/sessie/${sessionId}`;

    // Push to each friend
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.windping.com";
    await Promise.allSettled(
      friendIds.map((friendId: number) =>
        fetch(`${baseUrl}/api/push/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
          },
          body: JSON.stringify({ userId: friendId, title, message, url, alertType: "session" }),
        })
      )
    );
  } catch (e) {
    console.error("notifyFriends error:", e);
  }
}

/* ── POST: Create session ("Ik ga!" or direct complete) ── */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json() as Partial<DbSession>;
    const { spot_id, session_date, alert_id, forecast_wind, forecast_gust, forecast_dir, status } = body;
    
    if (!spot_id || !session_date) {
      return NextResponse.json({ error: "spot_id and session_date required" }, { status: 400 });
    }
    
    const supabase = sb();
    
    // Check if session already exists
    const { data: existing } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("created_by", userId)
      .eq("spot_id", spot_id)
      .eq("session_date", session_date)
      .single();
    
    if (existing) {
      return NextResponse.json({ error: "Session already exists", session: existing }, { status: 409 });
    }
    
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        created_by: userId,
        spot_id,
        session_date,
        alert_id: alert_id || null,
        status: status || "going",
        going_at: new Date().toISOString(),
        forecast_wind: forecast_wind || null,
        forecast_gust: forecast_gust || null,
        forecast_dir: forecast_dir || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ session: data });
  } catch (e) {
    console.error("POST /api/sessions error:", e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

/* ── PATCH: Update session (complete, skip, edit) ── */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json() as Record<string, unknown>;
    const { session_id, _notify_only, ...updates } = body;

    if (!session_id) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const supabase = sb();

    // Notify-only: just push to friends, no DB update
    if (_notify_only) {
      notifyFriendsSessionCompleted(supabase, userId, session_id as number).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    
    // Verify ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, created_by")
      .eq("id", session_id)
      .single();
    
    if (!session || (session as { created_by: number }).created_by !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    // Build update object
    interface SessionUpdate {
      status?: SessionStatus;
      rating?: number;
      wind_feel?: string;
      gear_type?: string;
      gear_size?: string;
      duration_minutes?: number;
      notes?: string;
      image_url?: string;
      photo_crop?: DbSession["photo_crop"];
      completed_at?: string;
    }
    const updateData: SessionUpdate = {};
    if (updates.status) updateData.status = updates.status as SessionStatus;
    if (updates.rating !== undefined) updateData.rating = updates.rating as number;
    if (updates.wind_feel) updateData.wind_feel = updates.wind_feel as string;
    if (updates.gear_type) updateData.gear_type = updates.gear_type as string;
    if (updates.gear_size !== undefined) updateData.gear_size = String(updates.gear_size);
    if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes as number;
    if (updates.notes !== undefined) updateData.notes = updates.notes as string;
    if (updates.photo_url) updateData.image_url = updates.photo_url as string;
    if (updates.photo_crop !== undefined) updateData.photo_crop = updates.photo_crop as DbSession["photo_crop"];
    if (updates.status === "completed") updateData.completed_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from("sessions")
      .update(updateData)
      .eq("id", session_id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Recalculate stats + badges after completion
    if (updates.status === "completed" || updates.rating) {
      await updateUserStats(supabase, userId);
    }

    // Notify friends when session is completed
    if (updates.status === "completed") {
      notifyFriendsSessionCompleted(supabase, userId, session_id as number).catch(() => {});
    }

    return NextResponse.json({ session: data });
  } catch (e) {
    console.error("PATCH /api/sessions error:", e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

/* ── GET: Fetch user sessions + stats ── */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "recent"; // recent | stats | all
    
    const supabase = sb();
    
    if (type === "stats") {
      // Return stats + badges
      const { data: stats } = await supabase
        .from("user_stats")
        .select("*")
        .eq("created_by", userId)
        .single();
      
      return NextResponse.json({ stats: stats || { total_sessions: 0, total_spots: 0, badges: [] } });
    }
    
    // Fetch sessions
    const limit = type === "all" ? 100 : 10;
    const { data: sessions } = await supabase
      .from("sessions")
      .select("*, spots(display_name)")
      .eq("created_by", userId)
      .order("session_date", { ascending: false })
      .limit(limit);
    
    // Also get stats
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("created_by", userId)
      .single();
    
    return NextResponse.json({
      sessions: sessions || [],
      stats: stats || { total_sessions: 0, total_spots: 0, badges: [] },
    });
  } catch (e) {
    console.error("GET /api/sessions error:", e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

/* ── DELETE: Remove a session ── */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("id");
    if (!sessionId) return NextResponse.json({ error: "Session id required" }, { status: 400 });

    const supabase = sb();

    // Verify ownership before deleting
    const { data: session } = await supabase
      .from("sessions")
      .select("id, created_by")
      .eq("id", sessionId)
      .eq("created_by", userId)
      .single();

    if (!session) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("created_by", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/sessions error:", e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

/* ── Recalculate user stats + badges ── */
async function updateUserStats(supabase: ReturnType<typeof sb>, userId: number) {
  try {
    // Get all sessions
    const { data: allSessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("created_by", userId);
    
    if (!allSessions) return;
    
    const sessions = allSessions as SessionRow[];
    const stats = calculateStats(sessions);
    const badges = calculateBadges(sessions, stats);
    
    // Upsert stats
    await supabase
      .from("user_stats")
      .upsert({
        created_by: userId,
        ...stats,
        badges: JSON.stringify(badges),
        updated_at: new Date().toISOString(),
      });
  } catch (e) {
    console.error("updateUserStats error:", e);
  }
}