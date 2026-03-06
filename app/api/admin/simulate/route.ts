/* ── app/api/admin/simulate/route.ts ───────────────────────
   Admin Simulation Endpoint
   - Create sessions on behalf of users
   - Manage friendships
   - View user feeds
   - View/delete sessions
   - View reactions
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

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!isAdmin(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("user_id");
  const client = sb();

  // Get all users with basic info
  if (action === "users") {
    const { data } = await client
      .from("users")
      .select("id, name, email")
      .order("name");
    return NextResponse.json({ users: data || [] });
  }

  // Get user's sessions
  if (action === "user_sessions" && userId) {
    const { data: sessions } = await client
      .from("sessions")
      .select("id, session_date, status, spot_id, rating, gear_type, gear_size, forecast_wind, forecast_dir, photo_url, notes, created_at, spots(display_name)")
      .eq("created_by", userId)
      .order("session_date", { ascending: false })
      .limit(20);

    return NextResponse.json({ sessions: sessions || [] });
  }

  // Get user's friendships
  if (action === "user_friendships" && userId) {
    const { data: friendships } = await client
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    const friendIds = (friendships || []).map(f =>
      f.user_id === Number(userId) ? f.friend_id : f.user_id
    );

    let friendUsers: any[] = [];
    if (friendIds.length > 0) {
      const { data } = await client
        .from("users")
        .select("id, name, email")
        .in("id", friendIds);
      friendUsers = data || [];
    }

    const enriched = (friendships || []).map(f => {
      const friendId = f.user_id === Number(userId) ? f.friend_id : f.user_id;
      const friend = friendUsers.find(u => u.id === friendId);
      return {
        id: f.id,
        friendId,
        friendName: friend?.name || friend?.email?.split("@")[0] || "?",
        status: f.status,
        createdAt: f.created_at,
      };
    });

    return NextResponse.json({ friendships: enriched });
  }

  // Get user's feed (what they would see)
  if (action === "user_feed" && userId) {
    const { data: friendships } = await client
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    const friendIds = (friendships || []).map(f =>
      f.user_id === Number(userId) ? f.friend_id : f.user_id
    );

    if (friendIds.length === 0) return NextResponse.json({ feed: [], friendCount: 0 });

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data: sessions } = await client
      .from("sessions")
      .select("id, created_by, spot_id, session_date, status, rating, gear_type, gear_size, forecast_wind, forecast_dir, photo_url, notes, spots(display_name)")
      .in("created_by", friendIds)
      .in("status", ["going", "completed"])
      .gte("session_date", since.toISOString().split("T")[0])
      .order("session_date", { ascending: false })
      .limit(20);

    const { data: users } = await client
      .from("users")
      .select("id, name, email")
      .in("id", friendIds);

    const nameMap: Record<number, string> = {};
    (users || []).forEach(u => { nameMap[u.id] = u.name || u.email?.split("@")[0] || "?"; });

    const feed = (sessions || []).map((s: any) => ({
      id: s.id,
      friendName: nameMap[s.created_by] || "?",
      friendId: s.created_by,
      spotName: s.spots?.display_name || `Spot #${s.spot_id}`,
      sessionDate: s.session_date,
      status: s.status,
      rating: s.rating,
      gearType: s.gear_type,
      gearSize: s.gear_size,
      forecastWind: s.forecast_wind,
      forecastDir: s.forecast_dir,
      photoUrl: s.photo_url,
      notes: s.notes,
    }));

    return NextResponse.json({ feed, friendCount: friendIds.length });
  }

  // Get all spots
  if (action === "spots") {
    const { data } = await client
      .from("spots")
      .select("id, display_name")
      .order("display_name")
      .limit(200);
    return NextResponse.json({ spots: data || [] });
  }

  // Get reactions for a session
  if (action === "session_reactions") {
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ reactions: [] });
    const { data } = await client
      .from("session_reactions")
      .select("id, reaction, user_id, created_at, users(name, email)")
      .eq("session_id", sessionId);
    return NextResponse.json({ reactions: data || [] });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!isAdmin(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;
  const client = sb();

  // Create a session on behalf of a user
  if (action === "create_session") {
    const { userId, spotId, sessionDate, status, rating, gearType, gearSize, forecastWind, forecastDir, notes } = body;
    const { data, error } = await client
      .from("sessions")
      .insert({
        created_by: userId,
        spot_id: spotId,
        session_date: sessionDate || new Date().toISOString().split("T")[0],
        status: status || "completed",
        rating: rating || null,
        gear_type: gearType || null,
        gear_size: gearSize || null,
        forecast_wind: forecastWind || null,
        forecast_dir: forecastDir || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, session: data });
  }

  // Create friendship between two users
  if (action === "create_friendship") {
    const { userId1, userId2 } = body;
    // Check if already exists
    const { data: existing } = await client
      .from("friendships")
      .select("id, status")
      .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
      .limit(1);

    if (existing?.length) {
      if (existing[0].status === "accepted") return NextResponse.json({ success: true, alreadyExists: true });
      // Update to accepted
      await client.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", existing[0].id);
      return NextResponse.json({ success: true, updated: true });
    }

    const { error } = await client.from("friendships").insert({
      user_id: userId1,
      friend_id: userId2,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!isAdmin(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const client = sb();

  // Delete a session
  if (action === "session") {
    const sessionId = url.searchParams.get("id");
    if (!sessionId) return NextResponse.json({ error: "id required" }, { status: 400 });
    await client.from("sessions").delete().eq("id", sessionId);
    return NextResponse.json({ success: true });
  }

  // Delete a friendship
  if (action === "friendship") {
    const friendshipId = url.searchParams.get("id");
    if (!friendshipId) return NextResponse.json({ error: "id required" }, { status: 400 });
    await client.from("friendships").delete().eq("id", friendshipId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}