"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export default function SessionReactions({
  sessionId,
  ownerId,
}: {
  sessionId: number;
  ownerId: number;
}) {
  const { user, token } = useUser();
  const [count, setCount]     = useState(0);
  const [stoked, setStoked]   = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (!user || !token) return;
    async function loadMine() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${user!.id}&reaction=eq.stoked&select=id`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStoked(data.length > 0);
    }
    loadMine();
  }, [user, token, sessionId]);

  async function handleStoked() {
    if (!user || !token || loading || user.id === ownerId) return;
    setLoading(true);

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    if (stoked) {
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${user.id}`, {
        method: "DELETE", headers,
      });
      setCount(c => Math.max(0, c - 1));
      setStoked(false);
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions`, {
        method: "POST", headers,
        body: JSON.stringify({ session_id: sessionId, user_id: user.id, reaction: "stoked" }),
      });
      setCount(c => c + 1);
      setStoked(true);
    }
    setLoading(false);
  }

  if (!user || user.id === ownerId) return null;

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