"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

function ModerationTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_posts?status=in.(flagged,blocked)&order=created_at.desc&select=id,type,content,author_name,status,created_at,spot_id`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await res.json();
        setPosts(data || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function deletePost(id: number) {
    if (!confirm("Post verwijderen?")) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/spot_posts?id=eq.${id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      setPosts(prev => prev.filter(p => p.id !== id));
      setMsg("\u2713 Post verwijderd");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("\u274c Fout"); }
  }

  async function approvePost(id: number) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/spot_posts?id=eq.${id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "ok" })
      });
      setPosts(prev => prev.filter(p => p.id !== id));
      setMsg("\u2713 Post goedgekeurd");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("\u274c Fout"); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {msg && <div style={{ background: msg.includes("\u2713") ? C.green : "#DC2626", color: "#fff", padding: "8px 16px", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
      <div style={{ marginBottom: 16, fontSize: 13, color: C.muted }}>
        {posts.length === 0 ? "Geen gemelde of geblokkeerde posts." : `${posts.length} post(s) vereisen aandacht.`}
      </div>
      {posts.map(post => (
        <div key={post.id} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 10, boxShadow: C.cardShadow, border: `1px solid ${post.status === "blocked" ? "#FECACA" : "#FDE68A"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: post.status === "blocked" ? "#FEE2E2" : "#FEF3C7", color: post.status === "blocked" ? "#DC2626" : "#D97706" }}>
                {post.status === "blocked" ? "GEBLOKKEERD" : "GEMELD"}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>{post.type} · spot #{post.spot_id}</span>
            </div>
            <span style={{ fontSize: 11, color: C.muted }}>{new Date(post.created_at).toLocaleDateString("nl-NL")}</span>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: C.navy, lineHeight: 1.5 }}>"{post.content}"</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{post.author_name}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => approvePost(post.id)} style={{ padding: "5px 12px", borderRadius: 8, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Goedkeuren
              </button>
              <button onClick={() => deletePost(post.id)} style={{ padding: "5px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ENRICHMENT CRON PANEL
   ══════════════════════════════════════════════════════════════ */


export { ModerationTab };
