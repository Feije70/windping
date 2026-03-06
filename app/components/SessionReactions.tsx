"use client";

import { useEffect, useState } from "react";
import { getValidToken, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export default function SessionReactions({
  sessionId,
  ownerId,
  userId: userIdProp,
  token: tokenProp,
}: {
  sessionId: number;
  ownerId: number;
  userId?: number | null;
  token?: string | null;
}) {
  const [count, setCount]       = useState(0);
  const [stoked, setStoked]     = useState(false);
  const [userId, setUserId]     = useState<number | null>(userIdProp ?? null);
  const [token, setToken]       = useState<string | null>(tokenProp ?? null);
  const [loading, setLoading]   = useState(false);

  // Resolve auth if not passed as props
  useEffect(() => {
    if (userIdProp && tokenProp) return;
    async function resolveAuth() {
      const authId = getAuthId();
      if (!authId) return;
      const t = await getValidToken();
      if (!t) return;
      setToken(t);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t}` },
      });
      const users = await res.json();
      if (users?.[0]?.id) setUserId(users[0].id);
    }
    resolveAuth();
  }, [userIdProp, tokenProp]);

  // Load stoked count
  useEffect(() => {
    async function load() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&reaction=eq.stoked&select=user_id`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.length);
    }
    load();
  }, [sessionId]);

  // Load my reaction
  useEffect(() => {
    if (!userId || !token) return;
    async function loadMine() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${userId}&reaction=eq.stoked&select=id`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStoked(data.length > 0);
    }
    loadMine();
  }, [userId, token, sessionId]);

  async function handleStoked() {
    if (!userId || !token || loading || userId === ownerId) return;
    setLoading(true);

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    if (stoked) {
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${userId}`, {
        method: "DELETE", headers,
      });
      setCount(c => Math.max(0, c - 1));
      setStoked(false);
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions`, {
        method: "POST", headers,
        body: JSON.stringify({ session_id: sessionId, user_id: userId, reaction: "stoked" }),
      });
      setCount(c => c + 1);
      setStoked(true);
    }
    setLoading(false);
  }

  if (!userId || userId === ownerId) return null;

  return (
    <button
      onClick={handleStoked}
      disabled={loading}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 20,
        border: stoked ? "1.5px solid #2E8FAE" : "1.5px solid rgba(31,53,76,0.12)",
        background: stoked ? "rgba(46,143,174,0.1)" : "transparent",
        color: stoked ? "#2E8FAE" : "#6B7B8F",
        fontSize: 13, fontWeight: stoked ? 700 : 500,
        cursor: "pointer", transition: "all 0.15s ease",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 16 }}>🤙</span>
      <span>Stoked{count > 0 ? ` · ${count}` : ""}</span>
    </button>
  );
}