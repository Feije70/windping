"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";

const VASTE_KOSTEN_DEFAULTS = [
  { id: "claude_max",    label: "Claude Max",           categorie: "AI",          bedrag: 100,   eenheid: "mnd", actief: true,  toelichting: "Claude Pro/Max abonnement voor development" },
  { id: "claude_api",    label: "Claude API credits",   categorie: "AI",          bedrag: 0,     eenheid: "mnd", actief: true,  toelichting: "Variabel — bijhouden op console.anthropic.com" },
  { id: "meteo_api",     label: "Meteo API",            categorie: "API",         bedrag: 0,     eenheid: "mnd", actief: true,  toelichting: "Weerdata API voor windverwachting" },
  { id: "getijde_api",   label: "Getijde API",          categorie: "API",         bedrag: 0,     eenheid: "mnd", actief: true,  toelichting: "Getijdendata API" },
  { id: "vercel",        label: "Vercel",               categorie: "Hosting",     bedrag: 0,     eenheid: "mnd", actief: true,  toelichting: "Hosting & deployment (gratis tier)" },
  { id: "supabase",      label: "Supabase",             categorie: "Database",    bedrag: 0,     eenheid: "mnd", actief: true,  toelichting: "Database & auth (gratis tier)" },
  { id: "bird_whatsapp", label: "Bird / WhatsApp",      categorie: "Messaging",   bedrag: 0,     eenheid: "per bericht", actief: false, toelichting: "WhatsApp Business API via Bird — kosten per bericht" },
  { id: "bird_vast",     label: "Bird vast tarief",     categorie: "Messaging",   bedrag: 0,     eenheid: "mnd", actief: false, toelichting: "Eventueel vast maandtarief Bird platform" },
  { id: "domein",        label: "Domein (windping.com)", categorie: "Overig",     bedrag: 15,    eenheid: "jaar", actief: true, toelichting: "Jaarlijkse domeinkosten" },
];

function FinancienTab({ tab, token }: { tab: string; token: string | null }) {
  const SK = "wp_fin_kosten";
  const SC = "wp_fin_campagnes";

  const [kosten, setKosten] = useState<any[]>([]);
  const [campagnes, setCampagnes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editKosten, setEditKosten] = useState<any>(null);

  // Nieuw campagne form
  const [newCamp, setNewCamp] = useState({ naam: "", type: "online", kanaal: "", bedrag: "", datum: new Date().toISOString().split("T")[0], notitie: "" });
  const [showNewCamp, setShowNewCamp] = useState(false);

  // Load from localStorage (client-side persistence, no backend needed)
  useEffect(() => {
    try {
      const savedKosten = localStorage.getItem(SK);
      setKosten(savedKosten ? JSON.parse(savedKosten) : VASTE_KOSTEN_DEFAULTS.map(k => ({ ...k })));
      const savedCamp = localStorage.getItem(SC);
      setCampagnes(savedCamp ? JSON.parse(savedCamp) : []);
    } catch {
      setKosten(VASTE_KOSTEN_DEFAULTS.map(k => ({ ...k })));
    }
  }, []);

  function saveKosten(updated: any[]) {
    setKosten(updated);
    localStorage.setItem(SK, JSON.stringify(updated));
  }

  function saveCampagnes(updated: any[]) {
    setCampagnes(updated);
    localStorage.setItem(SC, JSON.stringify(updated));
  }

  function updateKost(id: string, field: string, value: any) {
    const updated = kosten.map(k => k.id === id ? { ...k, [field]: value } : k);
    saveKosten(updated);
  }

  function addCampagne() {
    if (!newCamp.naam || !newCamp.bedrag) return;
    const updated = [...campagnes, { ...newCamp, id: Date.now().toString(), bedrag: parseFloat(newCamp.bedrag) }];
    saveCampagnes(updated);
    setNewCamp({ naam: "", type: "online", kanaal: "", bedrag: "", datum: new Date().toISOString().split("T")[0], notitie: "" });
    setShowNewCamp(false);
  }

  function deleteCampagne(id: string) {
    saveCampagnes(campagnes.filter(c => c.id !== id));
  }

  // Berekeningen
  const actieveKosten = kosten.filter(k => k.actief);
  const maandTotaal = actieveKosten
    .filter(k => k.eenheid === "mnd")
    .reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0);
  const jaarVaste = actieveKosten
    .filter(k => k.eenheid === "jaar")
    .reduce((s, k) => s + (parseFloat(k.bedrag) || 0), 0);
  const jaarTotaalVast = maandTotaal * 12 + jaarVaste;
  const campagneTotaal = campagnes.reduce((s, c) => s + (parseFloat(c.bedrag) || 0), 0);

  const categorieën = Array.from(new Set(kosten.map(k => k.categorie)));

  const inputStyle = { padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, color: C.navy, background: C.card, outline: "none" };

  if (tab === "kosten") return (
    <div>
      {/* Samenvatting */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Maandkosten (vast)", value: `€${maandTotaal.toFixed(2)}`, sub: "actieve maandabonnementen", color: C.sky },
          { label: "Jaarkosten totaal", value: `€${jaarTotaalVast.toFixed(2)}`, sub: "incl. jaarlijkse posten ×12", color: C.navy },
          { label: "Campagnes totaal", value: `€${campagneTotaal.toFixed(2)}`, sub: `${campagnes.length} campagne${campagnes.length !== 1 ? "s" : ""}`, color: C.gold },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: 14, padding: "16px 18px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        💡 Bedragen worden lokaal opgeslagen in je browser. Vul de API-kosten in zodra je de facturen hebt.
      </div>

      {/* Per categorie */}
      {categorieën.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" as const }}>{cat}</div>
          <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, overflow: "hidden" }}>
            {kosten.filter(k => k.categorie === cat).map((k, i, arr) => (
              <div key={k.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none",
                opacity: k.actief ? 1 : 0.5,
              }}>
                {/* Toggle actief */}
                <div onClick={() => updateKost(k.id, "actief", !k.actief)} style={{
                  width: 32, height: 18, borderRadius: 9, background: k.actief ? C.sky : C.creamDark,
                  border: `1px solid ${k.actief ? C.sky : C.cardBorder}`,
                  position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 1, left: k.actief ? 16 : 2, transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>

                {/* Label + toelichting */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{k.toelichting}</div>
                </div>

                {/* Bedrag input */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>€</span>
                  <input
                    type="number"
                    value={k.bedrag}
                    onChange={e => updateKost(k.id, "bedrag", e.target.value)}
                    style={{ ...inputStyle, width: 80, textAlign: "right" as const }}
                    min={0}
                    step="0.01"
                  />
                  <span style={{ fontSize: 11, color: C.muted, width: 70 }}>/{k.eenheid}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bird/WhatsApp uitleg */}
      <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>💬 WhatsApp via Bird</div>
        <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
          Bird rekent per WhatsApp bericht. Tarieven variëren per type bericht (template vs. sessie) en land.
          Vul hierboven de geschatte kosten in zodra Bird de prijzen bevestigt.
          Meta berekent daarnaast <strong>per 24-uurs conversatie</strong> (~€0.05–0.08 voor NL).
          Stel de waarden in zodra Bird/Meta template goedgekeurd is.
        </div>
      </div>
    </div>
  );

  // CAMPAGNES TAB
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>Campagnes & marketing</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Online en offline uitgaven handmatig bijhouden</div>
        </div>
        <button onClick={() => setShowNewCamp(true)} style={{
          padding: "8px 16px", background: C.sky, color: "#fff", border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>+ Campagne toevoegen</button>
      </div>

      {/* Samenvatting */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Totaal uitgegeven", value: `€${campagneTotaal.toFixed(2)}`, color: C.navy },
          { label: "Online", value: `€${campagnes.filter(c => c.type === "online").reduce((s, c) => s + c.bedrag, 0).toFixed(2)}`, color: C.sky },
          { label: "Offline", value: `€${campagnes.filter(c => c.type === "offline").reduce((s, c) => s + c.bedrag, 0).toFixed(2)}`, color: C.gold },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Nieuw campagne formulier */}
      {showNewCamp && (
        <div style={{ background: C.card, borderRadius: 12, padding: 16, boxShadow: C.cardShadow, marginBottom: 16, border: `1.5px solid ${C.sky}30` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Nieuwe campagne</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>NAAM</label>
              <input value={newCamp.naam} onChange={e => setNewCamp(p => ({ ...p, naam: e.target.value }))}
                placeholder="bijv. Instagram campagne april"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>TYPE</label>
              <select value={newCamp.type} onChange={e => setNewCamp(p => ({ ...p, type: e.target.value }))}
                style={{ ...inputStyle, width: "100%" }}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="overig">Overig</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>KANAAL</label>
              <input value={newCamp.kanaal} onChange={e => setNewCamp(p => ({ ...p, kanaal: e.target.value }))}
                placeholder="bijv. Instagram, Flyers, Google Ads"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>BEDRAG (€)</label>
              <input type="number" value={newCamp.bedrag} onChange={e => setNewCamp(p => ({ ...p, bedrag: e.target.value }))}
                placeholder="0.00" min={0} step="0.01"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>DATUM</label>
              <input type="date" value={newCamp.datum} onChange={e => setNewCamp(p => ({ ...p, datum: e.target.value }))}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>NOTITIE</label>
              <input value={newCamp.notitie} onChange={e => setNewCamp(p => ({ ...p, notitie: e.target.value }))}
                placeholder="optioneel"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addCampagne} style={{ padding: "8px 18px", background: C.sky, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Opslaan
            </button>
            <button onClick={() => setShowNewCamp(false)} style={{ padding: "8px 14px", background: C.creamDark, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.muted, cursor: "pointer" }}>
              Annuleer
            </button>
          </div>
        </div>
      )}

      {/* Campagne lijst */}
      {campagnes.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 12, padding: "32px 20px", boxShadow: C.cardShadow, textAlign: "center" as const }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Nog geen campagnes</div>
          <div style={{ fontSize: 12, color: C.muted }}>Voeg je eerste campagne toe via de knop hierboven.</div>
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 90px 28px", gap: 8, padding: "8px 16px", background: C.creamDark, fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            <span>Campagne</span><span>Type</span><span>Kanaal</span><span style={{ textAlign: "right" as const }}>Bedrag</span><span />
          </div>
          {campagnes.sort((a, b) => b.datum.localeCompare(a.datum)).map((c, i, arr) => (
            <div key={c.id} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 100px 90px 28px", gap: 8,
              padding: "12px 16px", alignItems: "center",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{c.naam}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{c.datum}{c.notitie ? ` · ${c.notitie}` : ""}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                background: c.type === "online" ? `${C.sky}15` : c.type === "offline" ? `${C.gold}15` : C.creamDark,
                color: c.type === "online" ? C.sky : c.type === "offline" ? C.gold : C.muted,
              }}>{c.type}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{c.kanaal || "—"}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.navy, textAlign: "right" as const }}>€{parseFloat(c.bedrag).toFixed(2)}</span>
              <button onClick={() => deleteCampagne(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 90px 28px", gap: 8, padding: "10px 16px", borderTop: `2px solid ${C.cardBorder}`, background: C.creamDark }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Totaal</span>
            <span /><span />
            <span style={{ fontSize: 14, fontWeight: 800, color: C.navy, textAlign: "right" as const }}>€{campagneTotaal.toFixed(2)}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SIMULATOR TAB
   ══════════════════════════════════════════════════════════════ */


export { FinancienTab };
