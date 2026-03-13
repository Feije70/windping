"use client";
import { useEffect, useState } from "react";
import { C, enrichmentLabels } from "../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

function stripCite(text: string): string {
  if (!text) return text;
  return text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, '$1').trim();
}

function EnrichmentResult({ spot, data, onSaved }: { spot: any; data: any; onSaved?: (spotId: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Editable categories — lees uit nl of en taallaag, of root als oud formaat
  function extractCats(categories: any): Record<string, string> {
    if (!categories) return {};
    // Nieuw formaat: { nl: {...}, en: {...} }
    const langCats = categories.nl || categories.en || null;
    const source = langCats && typeof langCats === "object" && !Array.isArray(langCats) ? langCats : categories;
    const result: Record<string, string> = {};
    Object.entries(source).forEach(([k, v]) => {
      if (typeof v === "string") result[k] = stripCite(v);
    });
    return result;
  }

  const [editCats, setEditCats] = useState<Record<string, string>>(() => extractCats(data.categories));
  const [editLang, setEditLang] = useState<string>(() => {
    const cats = data.categories || {};
    return cats.nl ? "nl" : cats.en ? "en" : "nl";
  });

  // Reset editCats als een andere spot geselecteerd wordt
  useEffect(() => {
    const cats = data.categories || {};
    const lang = cats.nl ? "nl" : cats.en ? "en" : "nl";
    setEditLang(lang);
    setEditCats(extractCats(cats));
    setSaved(false);
    setSaveError("");
  }, [spot.id]);

  async function saveToDb() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          spot_id: spot.id,
          confidence: data.confidence || 0,
          sources: data.sources || [],
          categories: (() => {
            // Nieuw formaat: bewaar bestaande taallagen, update huidige
            const existing = data.categories || {};
            const isMultiLang = existing.nl || existing.en;
            if (isMultiLang) {
              return { ...existing, [editLang]: editCats };
            }
            // Oud formaat → migreer naar nl
            return { nl: editCats };
          })(),
          missing: data.missing || [],
          scanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setSaveError(`Fout ${res.status}: ${text}`);
      } else {
        setSaved(true);
        onSaved?.(spot.id);
      }
    } catch (e: any) {
      setSaveError(e.message);
    }
    setSaving(false);
  }

  async function deleteFromDb() {
    if (!confirm(`Opgeslagen data voor ${spot.display_name} verwijderen?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot.id}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        setSaved(false);
        setSaveError("");
        alert(`✓ Data voor ${spot.display_name} verwijderd`);
      } else {
        setSaveError(`Verwijderen mislukt: ${res.status}`);
      }
    } catch (e: any) {
      setSaveError(e.message);
    }
    setDeleting(false);
  }

  if (data.error) {
    const isCredits = data.error === "insufficient_credits" || String(data.error).includes("credit") || String(data.error).includes("billing");
    return (
      <div style={{ padding: "14px 16px", background: isCredits ? "#FEF3C7" : "#FEF2F2", borderRadius: 10, border: `1px solid ${isCredits ? "#FDE68A" : "#FECACA"}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isCredits ? "#92400E" : "#DC2626", marginBottom: 4 }}>
          {isCredits ? "⚠️ Onvoldoende API credits" : "❌ Scan mislukt"}
        </div>
        <div style={{ fontSize: 12, color: isCredits ? "#92400E" : "#991B1B", lineHeight: 1.6 }}>
          {isCredits
            ? <><span>Voeg credits toe via </span><a href="https://console.anthropic.com/billing" target="_blank" rel="noreferrer" style={{ color: "#92400E", fontWeight: 700 }}>console.anthropic.com/billing</a><span>. De scan API verbruikt Anthropic credits per aanvraag.</span></>
            : String(data.error)}
        </div>
      </div>
    );
  }

  const labels: Record<string, string> = {
    conditions: "Windcondities & karakter",
    facilities: "Faciliteiten",
    hazards: "Gevaren",
    tips: "Tips",
    events: "Events & wedstrijden",
    news: "Actueel nieuws",
  };
  const conf = data.confidence || 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{spot.display_name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{spot.spot_type}</div>
        </div>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700,
          background: conf > 0.7 ? "#DCFCE7" : conf > 0.4 ? "#FEF3C7" : "#FEE2E2",
          color: conf > 0.7 ? "#166534" : conf > 0.4 ? "#92400E" : "#991B1B" }}>
          {conf > 0.7 ? "Hoge betrouwbaarheid" : conf > 0.4 ? "Redelijk betrouwbaar" : "Weinig gevonden"}
        </span>
      </div>

      {data.sources?.length > 0 && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Bronnen: {data.sources.join(" · ")}</div>
      )}

      {/* Taalwissel als meerdere talen beschikbaar */}
      {(data.categories?.nl || data.categories?.en) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {Object.keys(data.categories).filter(k => ["nl","en","de","fr","es","pt","it"].includes(k)).map(lang => (
            <button key={lang} onClick={() => {
              setEditLang(lang);
              const cats = data.categories[lang] || {};
              const result: Record<string, string> = {};
              Object.entries(cats).forEach(([k, v]) => { if (typeof v === "string") result[k] = stripCite(v); });
              setEditCats(result);
            }} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: editLang === lang ? C.sky : C.creamDark,
              color: editLang === lang ? "#fff" : C.muted,
              border: `1px solid ${editLang === lang ? C.sky : C.cardBorder}`,
            }}>{lang.toUpperCase()}</button>
          ))}
        </div>
      )}

      {/* Editable categorieën */}
      {Object.entries(editCats).map(([key, value]) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4,
            textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            {labels[key] || key}
          </div>
          <textarea
            value={value}
            onChange={e => setEditCats(prev => ({ ...prev, [key]: e.target.value }))}
            rows={4}
            style={{
              width: "100%", padding: "10px 12px", fontSize: 13, color: "#374151",
              lineHeight: 1.6, background: "#F9FAFB", borderRadius: 8,
              border: `1.5px solid ${C.cardBorder}`, outline: "none",
              resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const,
            }}
          />
        </div>
      ))}

      {data.missing?.length > 0 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, marginBottom: 12 }}>
          Niet gevonden: {data.missing.join(", ")}
        </div>
      )}

      {/* Acties */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.cardBorder}` }}>
        {saveError && (
          <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8, padding: "6px 10px", background: "#FEF2F2", borderRadius: 8 }}>
            ❌ {saveError}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {/* Opslaan */}
          <button
            onClick={saveToDb}
            disabled={saving || saved}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 10, border: "none",
              fontSize: 13, fontWeight: 700, cursor: saved ? "default" : "pointer",
              background: saved ? "#DCFCE7" : `linear-gradient(135deg, ${C.sky}, #4DB8C9)`,
              color: saved ? "#166534" : "#fff",
              opacity: saving ? 0.7 : 1, transition: "all 0.2s",
            }}
          >
            {saving ? "⏳ Opslaan..." : saved ? "✓ Opgeslagen" : "💾 Opslaan in database"}
          </button>

          {/* Verwijderen uit db */}
          <button
            onClick={deleteFromDb}
            disabled={deleting}
            style={{
              padding: "11px 14px", borderRadius: 10, border: "1px solid #FECACA",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: "#FEF2F2", color: "#DC2626",
              opacity: deleting ? 0.6 : 1,
            }}
            title="Verwijder opgeslagen data uit database"
          >
            {deleting ? "⏳" : "🗑️"}
          </button>
        </div>

        {!saved && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: "center" as const }}>
            Pas tekst aan waar nodig · Sluit zonder opslaan om te annuleren
          </div>
        )}
      </div>
    </div>
  );
}


/* ── Moderation Tab ── */

export { EnrichmentResult, stripCite };
