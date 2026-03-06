"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getValidToken, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export default function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getValidToken();
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      router.push("/mijn-sessies");
    } catch {
      setDeleting(false);
    }
  }

  if (confirm) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setConfirm(false)} style={{
          padding: "8px 16px", background: "rgba(255,255,255,0.1)", border: "none",
          borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          Annuleer
        </button>
        <button onClick={handleDelete} disabled={deleting} style={{
          padding: "8px 16px", background: "#C97A63", border: "none",
          borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          {deleting ? "Verwijderen..." : "Ja, verwijder"}
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)} style={{
      padding: "8px 16px", background: "rgba(255,255,255,0.1)", border: "none",
      borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer",
    }}>
      🗑 Verwijder sessie
    </button>
  );
}
