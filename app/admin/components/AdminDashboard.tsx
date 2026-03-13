"use client";
import { C } from "../lib/constants";
import { HealthData } from "../lib/types";
import { alertTypeColors, alertTypeEmoji } from "../lib/constants";
import { Card } from "./SharedUI";

function AdminDashboard({ stats, health, onNavigate }: {
  stats: { users: number; spots: number; alerts: number; alertsToday: number };
  health: HealthData | null;
  onNavigate: (section: string, tab?: string) => void;
}) {
  const criticals = health?.redFlags.filter(f => f.severity === "critical") || [];
  const warnings = health?.redFlags.filter(f => f.severity === "warning") || [];
  const systemOk = criticals.length === 0;

  return (
    <div>
      {/* Systeem status banner */}
      <div style={{
        background: systemOk ? C.goBg : "#FEF2F2",
        border: `1px solid ${systemOk ? `${C.green}30` : "#FECACA"}`,
        borderRadius: 12, padding: "14px 18px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: systemOk ? C.green : "#DC2626",
          boxShadow: `0 0 8px ${systemOk ? C.green : "#DC2626"}`,
        }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: systemOk ? C.green : "#DC2626" }}>
            {systemOk ? "Alle systemen operationeel" : `${criticals.length} kritieke problemen`}
          </div>
          {!systemOk && criticals.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: "#991B1B", marginTop: 2 }}>{f.message}</div>
          ))}
          {systemOk && warnings.length > 0 && (
            <div style={{ fontSize: 12, color: C.gold }}>{warnings.length} waarschuwing{warnings.length > 1 ? "en" : ""}</div>
          )}
        </div>
        {!systemOk && (
          <button onClick={() => onNavigate("alerts", "health")} style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 8, background: "#FEE2E2",
            border: "1px solid #FECACA", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Bekijk →</button>
        )}
      </div>

      {/* KPI kaartjes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Gebruikers", value: stats.users, sub: "totaal", color: C.sky, section: "gebruikers", tab: "users" },
          { label: "Spots", value: stats.spots, sub: "in database", color: C.sky, section: "content", tab: "enrichment" },
          { label: "Alerts 7d", value: health?.funnel.total || stats.alerts, sub: "verstuurd", color: C.green, section: "alerts", tab: "history" },
          { label: "Vandaag", value: stats.alertsToday, sub: "alerts", color: C.gold, section: "alerts", tab: "history" },
        ].map(k => (
          <button key={k.label} onClick={() => onNavigate(k.section, k.tab)} style={{
            background: C.card, borderRadius: 12, padding: "16px 14px", boxShadow: C.cardShadow,
            border: `1px solid ${C.cardBorder}`, cursor: "pointer", textAlign: "left" as const,
            transition: "transform 0.1s", display: "block", width: "100%",
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "")}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Alert funnel */}
      {health?.funnel && (
        <div style={{ background: C.card, borderRadius: 12, padding: "16px 18px", boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}`, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, marginBottom: 12 }}>Alert bezorging (7 dagen)</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Aangemaakt", value: health.funnel.total, color: C.sky },
              { label: "Email", value: health.funnel.emailSent, color: C.green },
              { label: "Push", value: health.funnel.pushSent, color: C.purple },
              { label: "Fouten", value: health.funnel.emailFailed + health.funnel.pushFailed, color: health.funnel.emailFailed + health.funnel.pushFailed > 0 ? "#DC2626" : C.muted },
            ].map(f => (
              <div key={f.label} style={{ flex: 1, textAlign: "center" as const }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.value}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snelkoppelingen */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>Snelkoppelingen</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Diagnose gebruiker", sub: "Waarom geen alert?", section: "alerts", tab: "diagnose", color: C.sky },
          { label: "Moderatie", sub: "Gemelde posts bekijken", section: "content", tab: "moderation", color: C.gold },
          { label: "Alert testen", sub: "Test email/push sturen", section: "alerts", tab: "test", color: C.green },
          { label: "Gebruikers beheer", sub: "Aanpassen & resetten", section: "gebruikers", tab: "users", color: C.sky },
          { label: "Spot enrichment", sub: "AI spot info scanner", section: "content", tab: "enrichment", color: C.purple },
          { label: "Alert history", sub: "Verstuurde alerts", section: "alerts", tab: "history", color: C.green },
        ].map(item => (
          <button key={item.label} onClick={() => onNavigate(item.section, item.tab)} style={{
            background: C.card, borderRadius: 10, padding: "12px 14px", boxShadow: C.cardShadow,
            border: `1px solid ${C.cardBorder}`, cursor: "pointer", textAlign: "left" as const,
            display: "block", width: "100%",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{item.label}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Enrichment Scanner Tab ── */
/* Tooltip helper */

export { AdminDashboard };
