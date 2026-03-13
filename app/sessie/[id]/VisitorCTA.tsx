"use client";

import Link from "next/link";
import { useUser } from "@/lib/hooks/useUser";

export default function VisitorCTA({ sessionId, createdBy }: { sessionId: number; createdBy: number }) {
  const { user, loading: authLoading } = useUser();

  // Wacht op auth, dan: toon alleen als niet ingelogd of niet de owner
  if (authLoading) return null;
  if (user && user.id === createdBy) return null;

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