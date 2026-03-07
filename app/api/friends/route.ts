/* ── app/api/friends/route.ts ──────────────────────────────
   WindPing Friends API — Build 26
   
   GET     - List friends + pending requests + friend activity
   POST    - Create invite code OR accept invite OR send request
   DELETE  - Remove friendship
   ──────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_ds6_HWMJEYxEnvrnEefeRg_q2T-ROO_";

async function getUserId(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await sb().from("users").select("id").eq("auth_id", user.id).single();
  return data?.id || null;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ── GET: List friends + activity + search ── */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "list";
    const supabase = sb();

    // SEARCH USERS — requires auth but handles it gracefully
    if (type === "search") {
      const q = url.searchParams.get("q") || "";
      if (q.length < 3) return NextResponse.json({ results: [] });

      // Get current user (optional for filtering)
      let currentUserId: number | null = null;
      try { currentUserId = await getUserId(req); } catch {}

      const { data: users, error } = await supabase
        .from("users")
        .select("id, name, email")
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);

      if (error) {
        console.error("Search error:", error);
        return NextResponse.json({ results: [], error: error.message });
      }

      let friendIds = new Set<number>();
      if (currentUserId) {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);
        friendIds = new Set((friendships || []).map(f => f.user_id === currentUserId ? f.friend_id : f.user_id));
      }

      const results = (users || [])
        .filter(u => u.id !== currentUserId)
        .filter(u => !friendIds.has(u.id))
        .map(u => ({
          id: u.id,
          name: u.name || u.email?.split("@")[0] || "Gebruiker",
          email: u.email ? u.email.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 4)) + c) : "",
        }));

      return NextResponse.json({ results });
    }

    // INVITE INFO — get inviter name from code (no auth needed)
    if (type === "invite_info") {
      const code = url.searchParams.get("code") || "";
      if (!code) return NextResponse.json({ inviterName: null });
      const { data: invite } = await supabase
        .from("friend_invites")
        .select("created_by")
        .eq("code", code.toUpperCase().trim())
        .is("used_by", null)
        .single();
      if (!invite) return NextResponse.json({ inviterName: null });
      const { data: user } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", invite.created_by)
        .single();
      return NextResponse.json({
        inviterName: user?.name || user?.email?.split("@")[0] || "Iemand",
      });
    }

    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (type === "activity") {
      // Get friend IDs
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq("status", "accepted");

      const friendIds = (friendships || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
      if (friendIds.length === 0) return NextResponse.json({ activity: [] });

      // Get recent "going" sessions from friends
      const since = new Date();
      since.setDate(since.getDate() - 3);

      const { data: sessions, error: sessError } = await supabase
        .from("sessions")
        .select("id, created_by, spot_id, session_date, status, going_at, rating, gear_type, gear_size, forecast_wind, forecast_dir, photo_url, photo_crop, notes")
        .in("created_by", friendIds)
        .in("status", ["going", "completed"])
        .gte("session_date", since.toISOString().split("T")[0])
        .order("created_at", { ascending: false })
        .limit(20);

      // Get spot names separately
      const spotIds = [...new Set((sessions || []).map(s => s.spot_id))];
      let spotMap: Record<number, string> = {};
      if (spotIds.length > 0) {
        const { data: spots } = await supabase
          .from("spots")
          .select("id, display_name")
          .in("id", spotIds);
        (spots || []).forEach(sp => { spotMap[sp.id] = sp.display_name; });
      }

      // Get friend names
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", friendIds);

      const nameMap: Record<number, string> = {};
      (users || []).forEach(u => { nameMap[u.id] = u.name || u.email?.split("@")[0] || "Vriend"; });

      const activity = (sessions || []).map(s => ({
        id: s.id,
        friendName: nameMap[s.created_by] || "Vriend",
        friendId: s.created_by,
        spotName: spotMap[s.spot_id] || "Onbekend",
        spotId: s.spot_id,
        sessionDate: s.session_date,
        status: s.status,
        rating: s.rating,
        gearType: s.gear_type,
        gearSize: s.gear_size,
        forecastWind: s.forecast_wind,
        forecastDir: s.forecast_dir,
        photoUrl: s.photo_url,
        photoCrop: s.photo_crop,
        notes: s.notes,
      }));

      return NextResponse.json({ activity });
    }

    // Default: list friends + pending
    const { data: friendships } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at, accepted_at")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    const friendUserIds = (friendships || [])
      .filter(f => f.status === "accepted")
      .map(f => f.user_id === userId ? f.friend_id : f.user_id);

    const pendingReceived = (friendships || [])
      .filter(f => f.friend_id === userId && f.status === "pending");

    const pendingSent = (friendships || [])
      .filter(f => f.user_id === userId && f.status === "pending");

    // Get user details for friends
    let friends: any[] = [];
    if (friendUserIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", friendUserIds);
      friends = (users || []).map(u => ({
        id: u.id,
        name: u.name || u.email?.split("@")[0] || "Vriend",
        friendshipId: (friendships || []).find(f =>
          (f.user_id === userId && f.friend_id === u.id) ||
          (f.friend_id === userId && f.user_id === u.id)
        )?.id,
      }));
    }

    // Get names for pending requests
    let pendingList: any[] = [];
    if (pendingReceived.length > 0) {
      const ids = pendingReceived.map(p => p.user_id);
      const { data: users } = await supabase.from("users").select("id, name, email").in("id", ids);
      pendingList = (users || []).map(u => ({
        id: u.id,
        name: u.name || u.email?.split("@")[0] || "Vriend",
        friendshipId: pendingReceived.find(p => p.user_id === u.id)?.id,
      }));
    }

    // Get user's active invite code
    const { data: invites } = await supabase
      .from("friend_invites")
      .select("code, expires_at")
      .eq("created_by", userId)
      .is("used_by", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    return NextResponse.json({
      friends,
      pending: pendingList,
      pendingSent: pendingSent.length,
      inviteCode: invites?.[0]?.code || null,
      totalFriends: friends.length,
    });
  } catch (e: any) {
    console.error("GET /api/friends error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── POST: Create invite / Accept invite / Send request ── */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;
    const supabase = sb();

    // CREATE INVITE CODE
    if (action === "create_invite") {
      const code = generateCode();
      const { data, error } = await supabase
        .from("friend_invites")
        .insert({ code, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ code: data.code, expiresAt: data.expires_at });
    }

    // ACCEPT INVITE CODE
    if (action === "accept_invite") {
      const { code } = body;
      if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

      const { data: invite } = await supabase
        .from("friend_invites")
        .select("*")
        .eq("code", code.toUpperCase().trim())
        .is("used_by", null)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (!invite) return NextResponse.json({ error: "Code ongeldig of verlopen" }, { status: 404 });
      if (invite.created_by === userId) return NextResponse.json({ error: "Je kunt je eigen code niet gebruiken" }, { status: 400 });

      // Check if already friends or pending
      const { data: existing } = await supabase
        .from("friendships")
        .select("id, status")
        .or(`and(user_id.eq.${invite.created_by},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${invite.created_by})`)
        .limit(1);

      if (existing?.length) {
        if (existing[0].status === "accepted") {
          // Already friends — not an error, just confirm
          const { data: friend } = await supabase.from("users").select("name, email").eq("id", invite.created_by).single();
          return NextResponse.json({
            success: true,
            friendName: friend?.name || friend?.email?.split("@")[0] || "Vriend",
          });
        }
        // Pending → upgrade to accepted
        await supabase.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", existing[0].id);
        await supabase.from("friend_invites").update({ used_by: userId, used_at: new Date().toISOString() }).eq("id", invite.id);
        const { data: friend } = await supabase.from("users").select("name, email").eq("id", invite.created_by).single();
        return NextResponse.json({
          success: true,
          friendName: friend?.name || friend?.email?.split("@")[0] || "Vriend",
        });
      }

      // Create friendship (auto-accepted via invite)
      const { error: friendError } = await supabase
        .from("friendships")
        .insert({
          user_id: invite.created_by,
          friend_id: userId,
          status: "accepted",
          accepted_at: new Date().toISOString(),
        });
      if (friendError) throw friendError;

      // Mark invite as used
      await supabase
        .from("friend_invites")
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq("id", invite.id);

      // Get friend name
      const { data: friend } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", invite.created_by)
        .single();

      return NextResponse.json({
        success: true,
        friendName: friend?.name || friend?.email?.split("@")[0] || "Vriend",
      });
    }

    // ACCEPT PENDING REQUEST
    if (action === "accept_request") {
      const { friendshipId } = body;
      if (!friendshipId) return NextResponse.json({ error: "friendshipId required" }, { status: 400 });

      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", friendshipId)
        .eq("friend_id", userId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // SEND FRIEND REQUEST (to existing user)
    if (action === "send_request") {
      const { friendId } = body;
      if (!friendId) return NextResponse.json({ error: "friendId required" }, { status: 400 });
      if (friendId === userId) return NextResponse.json({ error: "Je kunt jezelf niet toevoegen" }, { status: 400 });

      // Check if already friends or pending
      const { data: existing } = await supabase
        .from("friendships")
        .select("id, status")
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .limit(1);

      if (existing?.length) {
        if (existing[0].status === "accepted") return NextResponse.json({ success: true, alreadyFriends: true });
        // If THEY sent a pending request to ME, accept it
        const row = existing[0];
        await supabase.from("friendships").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", row.id);
        return NextResponse.json({ success: true, friendshipId: row.id });
      }

      const { data, error } = await supabase
        .from("friendships")
        .insert({ user_id: userId, friend_id: friendId, status: "pending" })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, friendshipId: data.id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error("POST /api/friends error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── DELETE: Remove friendship ── */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const friendshipId = url.searchParams.get("id");
    if (!friendshipId) return NextResponse.json({ error: "Friendship id required" }, { status: 400 });

    const supabase = sb();
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /api/friends error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}