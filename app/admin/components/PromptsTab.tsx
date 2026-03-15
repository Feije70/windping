"use client";
import { useEffect, useState } from "react";
import { C, PROMPT_CATEGORIEEN } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

function PromptsTab() {
  const [prompts, setPrompts] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    PROMPT_CATEGORIEEN.forEach(c => { defaults[c.key] = c.default; });
    return defaults;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activePrompt, setActivePrompt] = useState("conditions");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/enrichment_prompts?select=category,prompt_text&order=category.asc`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPrompts(prev => {
            const merged = { ...prev };
            (data as { category: string; prompt_text: string }[]).forEach(r => { if (r.prompt_text) merged[r.category] = r.prompt_text; });
            return merged;
          });
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function savePrompt(category: string) {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/enrichment_prompts`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({ category, prompt_text: prompts[category] || "", updated_at: new Date().toISOString() }),
      });
      if (res.ok) { setSaveMsg("✓ Opgeslagen"); }
      else { setSaveMsg("❌ Opslaan mislukt"); }
    } catch { setSaveMsg("❌ Fout"); }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  const active = PROMPT_CATEGORIEEN.find(c => c.key === activePrompt)!;

  return (
    <div>
      <div style={{ background: C.card, borderRadius: 12, padding: "14px 18px", marginBottom: 14, boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>Enrichment Prompts</div>
        <div style={{ fontSize: 13, color: C.muted }}>Beheer de AI-prompts per categorie. Wijzigingen worden direct gebruikt bij de volgende scan.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16 }}>
        {/* Categorie menu */}
        <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, padding: "8px 6px" }}>
          {PROMPT_CATEGORIEEN.map(c => (
            <button key={c.key} onClick={() => setActivePrompt(c.key)} style={{
              width: "100%", textAlign: "left" as const, padding: "10px 12px", borderRadius: 8, border: "none",
              background: activePrompt === c.key ? `${C.sky}12` : "transparent",
              color: activePrompt === c.key ? C.sky : C.navy,
              fontWeight: activePrompt === c.key ? 700 : 500, fontSize: 13, cursor: "pointer", marginBottom: 2,
            }}>
              {c.label}
              {prompts[c.key] ? <span style={{ display: "block", fontSize: 10, color: C.muted, fontWeight: 400, marginTop: 1 }}>✓ ingesteld</span> : <span style={{ display: "block", fontSize: 10, color: "#F59E0B", fontWeight: 400, marginTop: 1 }}>leeg</span>}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div style={{ background: C.card, borderRadius: 12, padding: 16, boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{active.label}</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{active.desc}</div>
          <textarea
            value={prompts[activePrompt] || ""}
            onChange={e => setPrompts(prev => ({ ...prev, [activePrompt]: e.target.value }))}
            rows={14}
            placeholder={active.default}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, fontSize: 13, color: C.navy, background: C.creamDark, resize: "vertical" as const, fontFamily: "monospace", boxSizing: "border-box" as const, lineHeight: 1.6 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button onClick={() => savePrompt(activePrompt)} disabled={saving} style={{
              padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none",
              background: C.sky, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1,
            }}>
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
            {saveMsg && <span style={{ fontSize: 12, fontWeight: 700, color: saveMsg.startsWith("✓") ? "#166534" : "#DC2626" }}>{saveMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


export { PromptsTab };