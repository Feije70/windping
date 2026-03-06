"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthId, getValidToken, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export default function VisitorCTA({ sessionId }: { sessionId: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function check() {
      const authId = getAuthId();
      if (!authId) { setShow(true); return; } // niet ingelogd → toon CTA
      const token = await getValidToken();
      if (!token) { setShow(true); return; }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}&select=created_by&limit=1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setShow(true); return; }
      const data = await res.json();
      const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const users = await usersRes.json();
      const isOwner = data?.[0]?.created_by === users?.[0]?.id;
      setShow(!isOwner);
    }
    check();
  }, [sessionId]);

  if (!show) return null;

  return (
    <div style={{ background: "#1F354C", borderRadius: 16, padding: "20px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Ook je sessies bijhouden?</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Join WindPing 🤙</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Link href="/signup" style={{ display: "inline-block", padding: "11px 22px", background: "#10B981", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          Aanmelden
        </Link>
        <Link href="/login" style={{ display: "inline-block", padding: "11px 22px", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Inloggen
        </Link>
      </div>
    </div>
  );
}