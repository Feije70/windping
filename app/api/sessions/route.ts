/* ── app/api/sessions/route.ts ─────────────────────────────
   WindPing Session API
   
   POST   - Create "Ik ga!" or complete a session
   GET    - Fetch user sessions + stats
   PATCH  - Update session (complete, skip, edit)
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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

/* ── Badge calculation ── */
const BADGE_DEFINITIONS = [
  { id: "early_bird", name: "Vroege Vogel", check: (sessions: any[]) => sessions.some(s => s.going_at && new Date(s.going_at).getHours() < 9) },
  { id: "storm_chaser", name: "Stormjager", check: (sessions: any[]) => sessions.some(s => (s.forecast_wind || 0) >= 30) },
  { id: "local_hero", name: "Local Hero", check: (sessions: any[]) => {
    const spotCounts: Record<number, number> = {};
    sessions.filter(s => s.status === "completed").forEach(s => { spotCounts[s.spot_id] = (spotCounts[s.spot_id] || 0) + 1; });
    return Object.values(spotCounts).some(c => c >= 10);
  }},
  { id: "call_in_sick", name: "Ziek Gemeld", check: (sessions: any[]) => sessions.some(s => {
    const day = new Date(s.session_date + "T12:00:00").getDay();
    return s.status === "completed" && day >= 1 && day <= 5;
  })},
  { id: "streak_5", name: "5x Streak", check: (_s: any[], stats: any) => (stats?.longest_streak || 0) >= 5 },
  { id: "explorer", name: "Ontdekker", check: (_s: any[], stats: any) => (stats?.total_spots || 0) >= 5 },
  { id: "tide_master", name: "Getij Meester", check: (sessions: any[]) => sessions.filter(s => s.status === "completed" && (s.rating || 0) >= 4).length >= 10 },
  { id: "night_rider", name: "Avondrijder", check: (sessions: any[]) => sessions.some(s => s.completed_at && new Date(s.completed_at).getHours() >= 18) },
];

function calculateBadges(sessions: any[], stats: any): string[] {
  return BADGE_DEFINITIONS.filter(b => b.check(sessions, stats)).map(b => b.id);
}

/* ── Stats calculation ── */
function calculateStats(sessions: any[]) {
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
  const avgRating = rated.length > 0 ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length : null;
  
  // Season sessions (March-October of current year)
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 2, 1); // March
  const seasonEnd = new Date(now.getFullYear(), 10, 1); // November
  const seasonSessions = completed.filter(s => {
    const d = new Date(s.session_date);
    return d >= seasonStart && d < seasonEnd;
  }).length;
  
  // Last session
  const sorted = completed.sort((a, b) => b.session_date.localeCompare(a.session_date));
  
  // Favorite gear
  const gearCounts: Record<string, number> = {};
  completed.filter(s => s.gear_size).forEach(s => { gearCounts[s.gear_size] = (gearCounts[s.gear_size] || 0) + 1; });
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

/* ── POST: Create session ("Ik ga!" or direct complete) ── */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json();
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
  } catch (e: any) {
    console.error("POST /api/sessions error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── PATCH: Update session (complete, skip, edit) ── */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json();
    const { session_id, ...updates } = body;
    
    if (!session_id) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }
    
    const supabase = sb();
    
    // Verify ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, created_by")
      .eq("id", session_id)
      .single();
    
    if (!session || session.created_by !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    // Build update object
    const updateData: any = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.wind_feel) updateData.wind_feel = updates.wind_feel;
    if (updates.gear_type) updateData.gear_type = updates.gear_type;
    if (updates.gear_size) updateData.gear_size = updates.gear_size;
    if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.photo_url) updateData.image_url = updates.photo_url;
    
    if (updates.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
    
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
    
    return NextResponse.json({ session: data });
  } catch (e: any) {
    console.error("PATCH /api/sessions error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
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
  } catch (e: any) {
    console.error("GET /api/sessions error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── Recalculate user stats + badges ── */
async function updateUserStats(supabase: any, userId: number) {
  try {
    // Get all sessions
    const { data: allSessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("created_by", userId);
    
    if (!allSessions) return;
    
    const stats = calculateStats(allSessions);
    const badges = calculateBadges(allSessions, stats);
    
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