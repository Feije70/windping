"use client";

import { useEffect, useState } from "react";
import { getValidToken, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

type ReactionType = "stoked" | "jealous" | "epic" | "going";

function StokedIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#2E8FAE" : "currentColor"} strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15c0 0-1.5-1-1.5-3.5V7a1.5 1.5 0 0 1 3 0v4" />
      <path d="M9 15V5.5a1.5 1.5 0 0 1 3 0V15" />
      <path d="M12 8.5a1.5 1.5 0 0 1 3 0V15" />
      <path d="M15 10a1.5 1.5 0 0 1 3 0v2c0 3-2 5-5 6H9c-2 0-3.5-1-4-3" />
    </svg>
  );
}

function JealousIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#8B7EC8" : "currentColor"} strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h12a3 3 0 1 0-3-3" />
      <path d="M3 12h16a3 3 0 1 1-3 3" />
      <path d="M3 16h8a3 3 0 1 0-3-3" />
    </svg>
  );
}

function EpicIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A83E" : "currentColor"} strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.5-1.5-2.5-1.5-4 0 0 1.5 1 1.5 3.5a2.5 2.5 0 0 0 2.5-2.5c0-3-3-5-3-8-2.5 2-4 4.5-4 7.5z" />
      <path d="M12 21a7 7 0 0 1-7-7c0-4 4-7 4-11 1.5 2 3 3.5 3 6a3 3 0 0 0 3 3" />
    </svg>
  );
}

function GoingIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3EAA8C" : "currentColor"} strokeWidth={active ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l4 7H8l4-7z" />
      <path d="M8 9l4 7 4-7" />
      <path d="M12 16v6" />
      <path d="M9 19l3 3 3-3" />
    </svg>
  );
}

const REACTIONS: { type: ReactionType; label: string; activeColor: string }[] = [
  { type: "stoked",  label: "Stoked",    activeColor: "#2E8FAE" },
  { type: "jealous", label: "Jaloers",   activeColor: "#8B7EC8" },
  { type: "epic",    label: "Epic",      activeColor: "#E8A83E" },
  { type: "going",   label: "Ik ga ook", activeColor: "#3EAA8C" },
];

function ReactionIcon({ type, active }: { type: ReactionType; active: boolean }) {
  if (type === "stoked")  return <StokedIcon active={active} />;
  if (type === "jealous") return <JealousIcon active={active} />;
  if (type === "epic")    return <EpicIcon active={active} />;
  return <GoingIcon active={active} />;
}

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
  const [counts, setCounts]         = useState<Record<ReactionType, number>>({ stoked: 0, jealous: 0, epic: 0, going: 0 });
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [userId, setUserId]         = useState<number | null>(userIdProp ?? null);
  const [token, setToken]           = useState<string | null>(tokenProp ?? null);
  const [loading, setLoading]       = useState(false);

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

  // Load reaction counts
  useEffect(() => {
    async function loadCounts() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&select=reaction,user_id`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      );
      if (!res.ok) return;
      const data: { reaction: ReactionType; user_id: number }[] = await res.json();
      const c: Record<ReactionType, number> = { stoked: 0, jealous: 0, epic: 0, going: 0 };
      for (const r of data) c[r.reaction] = (c[r.reaction] || 0) + 1;
      setCounts(c);
    }
    loadCounts();
  }, [sessionId]);

  // Load my reaction once userId + token are known
  useEffect(() => {
    if (!userId || !token) return;
    async function loadMine() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${userId}&select=reaction`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.[0]?.reaction) setMyReaction(data[0].reaction);
    }
    loadMine();
  }, [userId, token, sessionId]);

  async function handleReaction(type: ReactionType) {
    if (!userId || !token || loading || userId === ownerId) return;
    setLoading(true);

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    if (myReaction === type) {
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${userId}`, {
        method: "DELETE", headers,
      });
      setCounts(c => ({ ...c, [type]: Math.max(0, c[type] - 1) }));
      setMyReaction(null);
    } else {
      if (myReaction) {
        await fetch(`${SUPABASE_URL}/rest/v1/session_reactions?session_id=eq.${sessionId}&user_id=eq.${userId}`, {
          method: "DELETE", headers,
        });
        setCounts(c => ({ ...c, [myReaction]: Math.max(0, c[myReaction] - 1) }));
      }
      await fetch(`${SUPABASE_URL}/rest/v1/session_reactions`, {
        method: "POST", headers,
        body: JSON.stringify({ session_id: sessionId, user_id: userId, reaction: type }),
      });
      setCounts(c => ({ ...c, [type]: c[type] + 1 }));
      setMyReaction(type);
    }
    setLoading(false);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const isOwner = userId === ownerId;
  if (!userId && total === 0) return null;

  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 0 4px", flexWrap: "wrap" }}>
      {REACTIONS.map(({ type, label, activeColor }) => {
        const active = myReaction === type;
        const count = counts[type];
        const canReact = !!userId && !isOwner;
        return (
          <button
            key={type}
            onClick={() => canReact && handleReaction(type)}
            disabled={!canReact || loading}
            title={label}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px", borderRadius: 20,
              border: active ? `1.5px solid ${activeColor}` : "1.5px solid rgba(31,53,76,0.12)",
              background: active ? `${activeColor}15` : "transparent",
              color: active ? activeColor : "#6B7B8F",
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: canReact ? "pointer" : "default",
              transition: "all 0.15s ease",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <ReactionIcon type={type} active={active} />
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}