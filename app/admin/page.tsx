"use client";

import { useEffect, useState, useCallback } from "react";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, getEmail, getAuthId, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

/* ── Supabase helper ── */
async function sbGet(path: string) {
  const token = await getValidToken();
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function sbPatch(path: string, body: any) {
  const token = await getValidToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return res;
}

async function sbDelete(path: string) {
  const token = await getValidToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return res;
}

async function sbPost2(path: string, body: any) {
  const token = await getValidToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  return res;
}

async function apiPost(path: string, body: any) {
  const token = await getValidToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ── Types ── */
interface AlertHistoryItem {
  id: number;
  alert_type: string;
  target_date: string;
  spot_ids: number[];
  conditions: any;
  is_test: boolean;
  created_at: string;
  delivered_push: boolean;
  delivered_email: boolean;
}

interface UserInfo { id: number; email: string; name: string; }
interface SpotInfo { id: number; name?: string; display_name?: string; }

interface HealthData {
  timestamp: string;
  heartbeat: {
    lastRun: string | null;
    hoursSinceLastRun: number | null;
    recentRuns: { timestamp: string; alertCount: number; types: string[] }[];
    status: "healthy" | "warning" | "critical" | "unknown";
  };
  funnel: {
    total: number;
    emailSent: number;
    emailFailed: number;
    pushSent: number;
    pushFailed: number;
    byType: Record<string, number>;
    errors: any[];
  };
  users: {
    id: number;
    name: string;
    email: string;
    notifyEmail: boolean;
    notifyPush: boolean;
    isPaused: boolean;
    availableDays: number;
    lastAlertAt: string | null;
    lastAlertType: string | null;
    daysSinceAlert: number | null;
    totalAlerts7d: number;
    emailDelivered7d: number;
    pushDelivered7d: number;
  }[];
  redFlags: { severity: "critical" | "warning" | "info"; message: string; detail?: string }[];
}

/* ── Components ── */

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none",
        cursor: "pointer", padding: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.sky, textAlign: "left",
      }}>
        <span style={{ fontSize: 12, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.sky }}>{value}</div>
      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

const alertTypeColors: Record<string, string> = {
  heads_up: C.sky, go: C.green, epic: C.gold, downgrade: C.amber, alternative: C.purple,
};
const alertTypeEmoji: Record<string, string> = {
  heads_up: "📢", go: "✅", epic: "🤙", downgrade: "⬇️", alternative: "🔄",
};

const severityStyles: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: "#FEF2F2", border: "#FCA5A5", color: "#DC2626", icon: "🔴" },
  warning: { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", icon: "🟡" },
  info: { bg: "#EFF6FF", border: "#93C5FD", color: "#2563EB", icon: "🔵" },
};

/* ── Heartbeat Indicator ── */
function HeartbeatPanel({ heartbeat }: { heartbeat: HealthData["heartbeat"] }) {
  const statusColors = { healthy: C.green, warning: C.gold, critical: "#DC2626", unknown: C.muted };
  const statusLabels = { healthy: "Gezond", warning: "Let op", critical: "Kritiek", unknown: "Onbekend" };
  const statusColor = statusColors[heartbeat.status];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        {/* Animated heartbeat dot */}
        <div style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", background: `${statusColor}15`,
            position: "absolute", animation: heartbeat.status === "healthy" ? "heartPulse 2s ease-in-out infinite" : "none",
          }} />
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: statusColor, position: "relative", zIndex: 1 }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>{statusLabels[heartbeat.status]}</div>
          <div style={{ fontSize: 12, color: C.sub }}>
            {heartbeat.lastRun
              ? `Laatste run: ${new Date(heartbeat.lastRun).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`
              : "Geen runs gevonden"}
          </div>
          {heartbeat.hoursSinceLastRun !== null && (
            <div style={{ fontSize: 11, color: heartbeat.hoursSinceLastRun > 7 ? "#DC2626" : C.muted, fontWeight: heartbeat.hoursSinceLastRun > 7 ? 700 : 400 }}>
              {heartbeat.hoursSinceLastRun < 1
                ? `${Math.round(heartbeat.hoursSinceLastRun * 60)} minuten geleden`
                : `${heartbeat.hoursSinceLastRun} uur geleden`}
            </div>
          )}
        </div>
      </div>

      {/* Recent runs timeline */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>RECENTE RUNS</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {heartbeat.recentRuns.slice(0, 8).map((run, i) => {
          const d = new Date(run.timestamp);
          const label = d.toLocaleString("nl-NL", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
          return (
            <div key={i} style={{
              padding: "6px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: i === 0 ? `${C.green}15` : C.creamDark,
              color: i === 0 ? C.green : C.sub,
              border: `1px solid ${i === 0 ? `${C.green}30` : C.cardBorder}`,
            }}>
              {label} · {run.alertCount} alert{run.alertCount !== 1 ? "s" : ""}
            </div>
          );
        })}
      </div>

      {/* Cron schedule visual — 4 slots per day */}
      <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 6 }}>CRON SCHEMA (UTC)</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 6, 12, 18].map(hour => {
          const ran = heartbeat.recentRuns.some(r => {
            const d = new Date(r.timestamp);
            const isToday = d.toDateString() === new Date().toDateString();
            return isToday && d.getUTCHours() === hour;
          });
          return (
            <div key={hour} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, textAlign: "center",
              background: ran ? `${C.green}12` : `${C.amber}08`,
              border: `1.5px solid ${ran ? C.green : `${C.amber}40`}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ran ? C.green : C.amber }}>{ran ? "✓" : "—"}</div>
              <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{String(hour).padStart(2, "0")}:00</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Delivery Funnel ── */
function FunnelPanel({ funnel }: { funnel: HealthData["funnel"] }) {
  const emailRate = funnel.total > 0 ? Math.round((funnel.emailSent / funnel.total) * 100) : 0;
  const pushRate = funnel.total > 0 ? Math.round((funnel.pushSent / funnel.total) * 100) : 0;

  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10 }}>LAATSTE 7 DAGEN</div>
      
      {/* Funnel bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Alerts aangemaakt", value: funnel.total, color: C.sky, pct: 100 },
          { label: "Email bezorgd", value: funnel.emailSent, color: C.green, pct: emailRate },
          { label: "Push bezorgd", value: funnel.pushSent, color: C.purple || "#8B5CF6", pct: pushRate },
        ].map(item => (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: C.sub }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value} ({item.pct}%)</span>
            </div>
            <div style={{ height: 6, background: C.creamDark, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Type breakdown */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(funnel.byType).filter(([, v]) => v > 0).map(([type, count]) => (
          <div key={type} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: `${alertTypeColors[type] || C.muted}15`,
            color: alertTypeColors[type] || C.muted,
          }}>
            {alertTypeEmoji[type]} {type}: {count}
          </div>
        ))}
      </div>

      {/* Errors */}
      {funnel.errors.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FCA5A5" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>Delivery errors ({funnel.errors.length})</div>
          {funnel.errors.slice(0, 3).map((e, i) => (
            <div key={i} style={{ fontSize: 10, color: "#7F1D1D", marginBottom: 2 }}>{e.error}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Per-user status ── */
function UserStatusPanel({ users }: { users: HealthData["users"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {users.map(u => {
        const isHealthy = u.totalAlerts7d > 0 && u.emailDelivered7d > 0;
        const isWarning = u.daysSinceAlert !== null && u.daysSinceAlert > 3 && !u.isPaused;
        const statusColor = u.isPaused ? C.gold : isWarning ? C.amber : isHealthy ? C.green : C.muted;

        return (
          <Card key={u.id} style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Status dot */}
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0,
                boxShadow: isHealthy ? `0 0 6px ${C.green}60` : "none",
              }} />
              
              {/* Name + email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{u.name}</div>
                <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.email}
                </div>
              </div>

              {/* Status badges */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {u.isPaused && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${C.gold}20`, color: C.gold }}>PAUSED</span>
                )}
                {u.notifyEmail && (
                  <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: `${C.green}12`, color: C.green }}>📧</span>
                )}
                {u.notifyPush && (
                  <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: `${C.purple || "#8B5CF6"}12`, color: C.purple || "#8B5CF6" }}>📱</span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: C.sub }}>
              <span>📅 {u.availableDays} dagen</span>
              <span>🔔 {u.totalAlerts7d} alerts/7d</span>
              <span>📧 {u.emailDelivered7d} email/7d</span>
              <span>📱 {u.pushDelivered7d} push/7d</span>
            </div>

            {/* Last alert */}
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              {u.lastAlertAt
                ? `Laatste alert: ${new Date(u.lastAlertAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })} (${u.lastAlertType})`
                : "Nog geen alerts ontvangen"}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Red Flags ── */
function RedFlagsPanel({ flags }: { flags: HealthData["redFlags"] }) {
  if (flags.length === 0) {
    return (
      <Card style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${C.green}30` }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>Alles in orde</div>
          <div style={{ fontSize: 11, color: C.sub }}>Geen problemen gedetecteerd</div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {flags.map((flag, i) => {
        const s = severityStyles[flag.severity];
        return (
          <div key={i} style={{ padding: "10px 14px", background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: flag.detail ? 2 : 0 }}>
              <span style={{ fontSize: 12 }}>{s.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{flag.message}</span>
            </div>
            {flag.detail && <div style={{ fontSize: 10, color: s.color, opacity: 0.7, paddingLeft: 22 }}>{flag.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}




/* ── Admin Dashboard ── */
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
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ width: 16, height: 16, borderRadius: "50%", background: C.creamDark, border: `1px solid ${C.cardBorder}`, fontSize: 10, fontWeight: 700, color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help", flexShrink: 0 }}
      >?</span>
      {show && (
        <span style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", background: C.navy, color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 8, zIndex: 100, maxWidth: 260, whiteSpace: "normal" as const, lineHeight: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {text}
        </span>
      )}
    </span>
  );
}

const NL_REGIONS = ["Noord-Holland", "Zuid-Holland", "Zeeland", "Friesland", "Zeeland, Netherlands", "Groningen", "Drenthe", "Overijssel", "Gelderland", "Utrecht", "Noord-Brabant", "Limburg", "Flevoland"];

function getLand(region: string): string {
  if (!region) return "Overig";
  if (NL_REGIONS.includes(region)) return "Nederland";
  const parts = region.split(", ");
  return parts.length > 1 ? parts[parts.length - 1] : region;
}

const LAND_VLAG: Record<string, string> = {
  Nederland: "🇳🇱", Spain: "🇪🇸", Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹",
  Portugal: "🇵🇹", Greece: "🇬🇷", Denmark: "🇩🇰", Ireland: "🇮🇪", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Croatia: "🇭🇷", Norway: "🇳🇴", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Belgium: "🇧🇪", Poland: "🇵🇱",
  Morocco: "🇲🇦", Bulgaria: "🇧🇬", Sweden: "🇸🇪", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Turkey: "🇹🇷",
  Austria: "🇦🇹", Switzerland: "🇨🇭", Latvia: "🇱🇻", Romania: "🇷🇴", Hungary: "🇭🇺",
  Montenegro: "🇲🇪", Azores: "🇵🇹",
};
const LAND_CODE: Record<string, string> = {
  "Nederland": "NL",
  "België": "BE",
  "Duitsland": "DE",
  "Frankrijk": "FR",
  "Spanje": "ES",
  "Portugal": "PT",
  "Italië": "IT",
  "Griekenland": "GR",
  "Turkije": "TR",
  "Marokko": "MA",
  "Zuid-Afrika": "ZA",
  "Australië": "AU",
  "Brazilië": "BR",
  "USA": "US",
};


const PROMPT_CATEGORIEEN = [
  { key: "conditions", label: "Conditions", desc: "Windcondities, golfhoogte, seizoenen",
    default: "Wind conditions, directions, best season, wave height, currents, water type. Null if unknown." },
  { key: "facilities", label: "Facilities", desc: "Faciliteiten, parkeren, huur",
    default: "Parking, toilets, showers, food, kite school, rental. Null if unknown." },
  { key: "hazards", label: "Hazards", desc: "Gevaren, regels, obstakels",
    default: "Hazards: rocks, currents, shipping, restricted zones, rules. Null if unknown." },
  { key: "tips", label: "Tips", desc: "Insider tips, beste tijden",
    default: "Practical tips from experienced surfers, best launch spot, local knowledge. Null if unknown." },
  { key: "events", label: "Events", desc: "Evenementen, wedstrijden",
    default: "Kite/windsurf competitions, festivals, markets, events affecting crowding. Null if unknown." },
  { key: "news", label: "News", desc: "Nieuws, recente ontwikkelingen",
    default: "Recent news: beach closures, new rules, construction, upcoming major events. Null if unknown." },
];

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
            data.forEach((r: any) => { if (r.prompt_text) merged[r.category] = r.prompt_text; });
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

function EnrichmentTab() {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [resultMap, setResultMap] = useState<Record<number, any>>({});
  const [viewId, setViewId] = useState<number | null>(null);
  const [scanProgress, setScanProgress] = useState("");
  const [spotSearch, setSpotSearch] = useState("");
  const [selectedLand, setSelectedLand] = useState<string | null>(null);
  const [selectedLanden, setSelectedLanden] = useState<Set<string>>(new Set());
  const [landLimits, setLandLimits] = useState<Record<string, number>>({});
  const [triggerMsg, setTriggerMsg] = useState("");
  const [triggerLoading, setTriggerLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?order=display_name.asc&select=id,display_name,spot_type,region,latitude,longitude&limit=5000`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Range-Unit": "items", "Range": "0-4999" }
        });
        const data = await res.json();
        setSpots(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filteredSpots = spots.filter(s => {
    const matchSearch = spotSearch.length >= 2 ? s.display_name.toLowerCase().includes(spotSearch.toLowerCase()) : true;
    const matchLand = selectedLand ? getLand(s.region) === selectedLand
      : selectedLanden.size > 0 ? selectedLanden.has(getLand(s.region))
      : true;
    return matchSearch && matchLand;
  });

  function toggleCheck(id: number) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === filteredSpots.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredSpots.map((s: any) => s.id)));
    }
  }

  function toggleLand(land: string) {
    setSelectedLanden(prev => {
      const next = new Set(prev);
      if (next.has(land)) next.delete(land); else next.add(land);
      return next;
    });
  }

  async function triggerCron(mode: string) {
    if (selectedLanden.size === 0 && mode !== "active") {
      setTriggerMsg("Selecteer eerst een of meer landen");
      setTimeout(() => setTriggerMsg(""), 3000);
      return;
    }
    setTriggerLoading(true);
    setTriggerMsg("Bezig...");
    try {
      if (mode === "active") {
        if (!confirm("Alle actieve spots opnieuw scannen? Dit kan lang duren.")) { setTriggerLoading(false); return; }
        const res = await fetch(`/api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=active`);
        const data = await res.json();
        setTriggerMsg(`✓ ${data.queued} spots ingepland voor refresh`);
      } else {
        const landen = Array.from(selectedLanden);
        let totaal = 0;
        for (const land of landen) {
          const limit = landLimits[land] || 10;
          const countryCode = LAND_CODE[land] || land;
          const res = await fetch(`/api/enrichment-full-trigger?key=WindPing-cron-key-2026&mode=new_only&limit=${limit}&country=${countryCode}`);
          const data = await res.json();
          totaal += data.queued || 0;
        }
        setTriggerMsg(`✓ ${totaal} spots ingepland (${landen.join(", ")})`);
      }
    } catch { setTriggerMsg("❌ Mislukt"); }
    setTriggerLoading(false);
    setTimeout(() => setTriggerMsg(""), 5000);
  }

  async function triggerNieuws() {
    if (!confirm("Nieuws-check starten voor alle actieve spots?")) return;
    setTriggerLoading(true);
    setTriggerMsg("Nieuws-check starten...");
    try {
      const res = await fetch(`/api/enrichment-news-trigger?key=WindPing-cron-key-2026`);
      const data = await res.json();
      setTriggerMsg(`✓ Nieuws-check gestart: ${data.queued} spots`);
    } catch { setTriggerMsg("❌ Mislukt"); }
    setTriggerLoading(false);
    setTimeout(() => setTriggerMsg(""), 5000);
  }

  async function scanChecked() {
    const toScan = spots.filter(s => checkedIds.has(s.id));
    if (toScan.length === 0) return;
    setScanning(true);
    for (let i = 0; i < toScan.length; i++) {
      const spot = toScan[i];
      setScanProgress(`${i + 1}/${toScan.length}: ${spot.display_name}`);
      let retries = 0;
      while (retries < 3) {
        try {
          const res = await fetch("/api/enrichment-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spot }),
          });
          const data = await res.json();

          if (res.status === 429 || JSON.stringify(data).includes("rate_limit")) {
            retries++;
            const wait = 15 * retries;
            for (let s = wait; s > 0; s--) {
              setScanProgress(`⏳ Rate limit — wacht ${s}s (${i + 1}/${toScan.length})`);
              await new Promise(r => setTimeout(r, 1000));
            }
            continue;
          }

          const hasCreditsError = JSON.stringify(data).toLowerCase().includes("credit") || JSON.stringify(data).toLowerCase().includes("billing") || JSON.stringify(data).toLowerCase().includes("low");
          const spotResult = hasCreditsError ? { error: "insufficient_credits" } : data;
          setResultMap(prev => ({ ...prev, [spot.id]: spotResult }));
          setViewId(spot.id);
          break;
        } catch {
          setResultMap(prev => ({ ...prev, [spot.id]: { error: "Scannen mislukt" } }));
          break;
        }
      }
      // 4s tussen spots om binnen 30k tokens/min te blijven (~15 spots/min max)
      if (i < toScan.length - 1) {
        for (let s = 15; s > 0; s--) {
          setScanProgress(`${i + 1}/${toScan.length}: ${spot.display_name} ✓ — volgende over ${s}s`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    setScanProgress("");
    setScanning(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  const checkedCount = checkedIds.size;
  const scannedSpots = spots.filter(s => resultMap[s.id]);

  const landenMap: Record<string, any[]> = {};
  spots.forEach(s => {
    const land = getLand(s.region);
    if (!landenMap[land]) landenMap[land] = [];
    landenMap[land].push(s);
  });
  const landenSorted = Object.entries(landenMap)
    .filter(([land]) => land !== "Overig")
    .sort((a, b) => b[1].length - a[1].length);

  const nlCount = (landenMap["Nederland"] || []).length;


  return (
    <div>
      {/* Header */}
      <div style={{ background: C.card, borderRadius: 12, padding: "14px 18px", marginBottom: 14, boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 4 }}>Spot Enrichment Scanner</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Scant publieke informatie via AI per spot. Scan spots en sla de resultaten op in de database.
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.sky, whiteSpace: "nowrap" as const, marginLeft: 16 }}>{spots.length} spots</span>
      </div>

      {/* Snelkeuze landen */}
      <div style={{ background: C.card, borderRadius: 10, padding: "10px 14px", marginBottom: 12, boxShadow: C.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, whiteSpace: "nowrap" as const }}>HANDMATIGE SCAN — FILTER OP LAND</span>
          {selectedLand && (
            <button onClick={() => setSelectedLand(null)} style={{
              padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700,
              border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
            }}>✕ {selectedLand}</button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {landenSorted.map(([land, ls]) => {
            const isActive = selectedLand === land;
            return (
              <button key={land} disabled={scanning} onClick={() => setSelectedLand(isActive ? null : land)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: isActive ? 700 : 600,
                border: `1px solid ${isActive ? C.sky : C.cardBorder}`,
                background: isActive ? C.sky : C.creamDark,
                color: isActive ? "#fff" : C.navy,
                cursor: scanning ? "default" : "pointer",
              }}>{LAND_VLAG[land] || "🌍"} {land} ({ls.length})</button>
            );
          })}
        </div>
      </div>

      {/* Cron trigger sectie */}
      <div style={{ background: C.card, borderRadius: 10, padding: "12px 14px", marginBottom: 12, boxShadow: C.cardShadow, border: `1px solid ${C.cardBorder}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10 }}>CRON TRIGGER — NIEUWE SPOTS INPLANNEN</div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 10 }}>
          {landenSorted.map(([land, ls]) => {
            const isActive = selectedLanden.has(land);
            return (
              <div key={land} style={{ display: "flex", alignItems: "center", gap: 4, background: isActive ? `${C.sky}10` : C.creamDark, border: `1px solid ${isActive ? C.sky : C.cardBorder}`, borderRadius: 8, padding: "4px 6px 4px 8px" }}>
                <button onClick={() => toggleLand(land)} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 11,
                  fontWeight: isActive ? 700 : 500, color: isActive ? C.sky : C.navy, padding: 0,
                }}>
                  {LAND_VLAG[land] || "🌍"} {land} ({ls.length})
                </button>
                {isActive && (
                  <input
                    type="number" min={1} max={ls.length} value={landLimits[land] ?? 10}
                    onChange={e => setLandLimits(prev => ({ ...prev, [land]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    style={{ width: 44, padding: "2px 4px", borderRadius: 5, border: `1px solid ${C.sky}40`, fontSize: 11, fontWeight: 700, color: C.navy, textAlign: "center" as const, background: "#fff" }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
          <button
            onClick={() => triggerCron("new_only")}
            disabled={triggerLoading || selectedLanden.size === 0}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: selectedLanden.size > 0 ? "pointer" : "not-allowed", background: selectedLanden.size > 0 ? C.sky : C.creamDark, color: selectedLanden.size > 0 ? "#fff" : C.muted, border: "none", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Scan nieuwe spots
          </button>
          <button
            onClick={() => triggerCron("active")}
            disabled={triggerLoading}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Jaarlijkse refresh (alle actieve)
          </button>
          <button
            onClick={triggerNieuws}
            disabled={triggerLoading}
            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", opacity: triggerLoading ? 0.6 : 1 }}
          >
            Nieuws-check
          </button>
          {triggerMsg && (
            <span style={{ fontSize: 12, fontWeight: 700, color: triggerMsg.startsWith("✓") ? "#166534" : triggerMsg.startsWith("❌") ? "#DC2626" : C.sky }}>
              {triggerMsg}
            </span>
          )}
        </div>
      </div>

      {/* Geselecteerde spots strip */}
      {checkedCount > 0 && (
        <div style={{ background: `${C.sky}08`, border: `1px solid ${C.sky}20`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.sky, flexShrink: 0 }}>{checkedCount} geselecteerd:</span>
          {spots.filter(s => checkedIds.has(s.id)).slice(0, 15).map(s => (
            <span key={s.id} onClick={() => toggleCheck(s.id)} style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4, background: C.sky, color: "#fff",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            }}>{s.display_name} <span style={{ opacity: 0.7 }}>×</span></span>
          ))}
          {checkedCount > 15 && <span style={{ fontSize: 11, color: C.muted }}>+{checkedCount - 15} meer</span>}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={scanChecked}
            disabled={scanning || checkedCount === 0}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none",
              background: checkedCount > 0 ? C.sky : C.creamDark,
              color: checkedCount > 0 ? "#fff" : C.muted,
              cursor: (scanning || checkedCount === 0) ? "default" : "pointer",
              opacity: scanning ? 0.6 : 1,
            }}
          >
            {scanning ? `⏳ ${scanProgress}` : `🔍 Scan ${checkedCount > 0 ? `${checkedCount} geselecteerde spot${checkedCount > 1 ? "s" : ""}` : "geselecteerde spots"}`}
          </button>
          <Tip text="Vink spots aan in de lijst, dan hier op scannen klikken. Je kunt meerdere spots tegelijk selecteren en in één keer scannen." />
        </div>

        {checkedCount > 0 && !scanning && (
          <button onClick={() => { setCheckedIds(new Set()); setResultMap({}); setViewId(null); }} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: C.creamDark, border: `1px solid ${C.cardBorder}`, color: C.muted, cursor: "pointer" }}>
            Wis selectie
          </button>
        )}

        <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>{spots.length} spots totaal</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        {/* Spot lijst met checkboxes */}
        <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, display: "flex", flexDirection: "column", maxHeight: 640 }}>
          {/* Zoek + selecteer alle */}
          <div style={{ padding: "10px 10px 6px", borderBottom: `1px solid ${C.cardBorder}` }}>
            <input
              placeholder="Zoek spot..."
              value={spotSearch}
              onChange={e => setSpotSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontSize: 12, color: C.navy, background: C.creamDark, boxSizing: "border-box" as const, outline: "none", marginBottom: 6 }}
            />
            <button onClick={toggleAll} style={{ fontSize: 11, color: C.sky, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
              {checkedIds.size === filteredSpots.length && filteredSpots.length > 0 ? "✓ Alles deselecteren" : `Selecteer alle ${filteredSpots.length > 0 ? `(${filteredSpots.length})` : ""}`}
            </button>
          </div>

          <div style={{ overflowY: "auto" as const, flex: 1, padding: "4px 6px 8px" }}>
            {filteredSpots.map((spot: any) => {
              const checked = checkedIds.has(spot.id);
              const isScanning = scanning && scanProgress.includes(spot.display_name);
              return (
                <div
                  key={spot.id}
                  onClick={() => !scanning && toggleCheck(spot.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8,
                    marginBottom: 2, cursor: scanning ? "default" : "pointer",
                    background: checked ? `${C.sky}12` : "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${checked ? C.sky : C.cardBorder}`,
                    background: checked ? C.sky : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: checked ? 700 : 500, color: checked ? C.sky : C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spot.display_name}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{spot.region ? `${spot.region} · ` : ""}{spot.spot_type || "—"}</div>
                  </div>
                  {isScanning && <div style={{ width: 12, height: 12, border: `2px solid ${C.sky}40`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />}
                </div>
              );
            })}
            {filteredSpots.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, padding: "12px 10px" }}>Geen spots gevonden</div>
            )}
          </div>
        </div>

        {/* Resultaten */}
        <div style={{ background: C.card, borderRadius: 12, padding: 16, boxShadow: C.cardShadow, maxHeight: 640, overflowY: "auto" as const }}>
          {scanning && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid #93C5FD`, borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#1D4ED8" }}>{scanProgress}</span>
            </div>
          )}

          {/* Resultaten navigatie tabs als meerdere gescand */}
          {scannedSpots.length > 1 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
              {scannedSpots.map(spot => (
                <button key={spot.id} onClick={() => setViewId(spot.id)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                  background: viewId === spot.id ? C.sky : C.creamDark,
                  color: viewId === spot.id ? "#fff" : C.muted,
                }}>
                  {resultMap[spot.id]?.error ? "⚠️ " : "✅ "}{spot.display_name}
                </button>
              ))}
            </div>
          )}

          {viewId && resultMap[viewId] && (() => {
            const spot = spots.find(s => s.id === viewId);
            return spot ? <EnrichmentResult spot={spot} data={resultMap[viewId]} /> : null;
          })()}

          {scannedSpots.length === 0 && !scanning && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>☑️</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Vink spots aan</div>
              <div style={{ fontSize: 12, textAlign: "center" as const, lineHeight: 1.7 }}>
                Selecteer één of meerdere spots via de checkboxes links,<br />klik dan op de scan knop hierboven.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SVG Iconen voor enrichment categorieën ──
const EnrichmentIcons: Record<string, () => React.ReactElement> = {
  news: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
      <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
    </svg>
  ),
  events: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  ),
  conditions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>
  ),
  hazards: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  facilities: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  tips: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7Z"/>
      <path d="M10 21h4"/>
    </svg>
  ),
};

// ── Enrichment Beheer Tab ──
function EnrichmentBeheerTab() {
  const [saved, setSaved] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editCats, setEditCats] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const labels: Record<string, string> = {
    conditions: "Windcondities & karakter",
    facilities: "Faciliteiten",
    hazards: "Gevaren",
    tips: "Tips",
    events: "Events & wedstrijden",
    news: "Actueel nieuws",
  };

  useEffect(() => {
    async function load() {
      const [enrichRes, spotsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?select=*&order=updated_at.desc`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,region,spot_type&limit=5000`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        }).then(r => r.json()),
      ]);
      setSaved(Array.isArray(enrichRes) ? enrichRes : []);
      setSpots(Array.isArray(spotsRes) ? spotsRes : []);
      setLoading(false);
    }
    load();
  }, []);

  function getSpot(spot_id: number) {
    return spots.find(s => s.id === spot_id);
  }

  function startEdit(row: any) {
    setEditId(row.spot_id);
    const cats: Record<string, string> = {};
    const raw = row.categories || {};
    // Nieuw formaat: { nl: {...}, en: {...} } — pak nl of en laag
    const source = raw.nl || raw.en || raw;
    if (source && typeof source === "object") {
      Object.entries(source).forEach(([k, v]) => {
        if (typeof v === "string") cats[k] = v;
      });
    }
    setEditCats(cats);
    setMsg("");
  }

  async function saveEdit(spot_id: number, row: any) {
    setSaving(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        spot_id,
        confidence: row.confidence,
        sources: row.sources,
        categories: editCats,
        missing: row.missing,
        scanned_at: row.scanned_at,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      setSaved(prev => prev.map(r => r.spot_id === spot_id ? { ...r, categories: editCats, updated_at: new Date().toISOString() } : r));
      setMsg("✓ Opgeslagen");
      setEditId(null);
    } else {
      setMsg("❌ Opslaan mislukt");
    }
    setSaving(false);
  }

  async function deleteRow(spot_id: number, spotName: string) {
    if (!confirm(`Enrichment data voor ${spotName} verwijderen?`)) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot_id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (res.ok) {
      setSaved(prev => prev.filter(r => r.spot_id !== spot_id));
      if (editId === spot_id) setEditId(null);
      setMsg("✓ Verwijderd");
    } else {
      setMsg("❌ Verwijderen mislukt");
    }
  }

  const filtered = saved.filter(r => {
    const spot = getSpot(r.spot_id);
    if (!spot) return true;
    return spot.display_name.toLowerCase().includes(searchQ.toLowerCase());
  });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Opgeslagen spots", value: saved.length, color: C.sky },
          { label: "Hoog betrouwbaar", value: saved.filter(r => (r.confidence || 0) > 0.7).length, color: C.green },
          { label: "Laag betrouwbaar", value: saved.filter(r => (r.confidence || 0) <= 0.4).length, color: C.amber },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 700,
          background: msg.startsWith("✓") ? "#DCFCE7" : "#FEF2F2",
          color: msg.startsWith("✓") ? "#166534" : "#DC2626",
        }}>{msg}</div>
      )}

      {/* Zoekbalk */}
      <input
        placeholder="Zoek op spotnaam..."
        value={searchQ}
        onChange={e => setSearchQ(e.target.value)}
        style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 13, color: C.navy, background: C.card, outline: "none", marginBottom: 14, boxSizing: "border-box" as const }}
      />

      {/* Lijst */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>
          Geen opgeslagen enrichment data gevonden.
        </div>
      ) : filtered.map(row => {
        const spot = getSpot(row.spot_id);
        const conf = row.confidence || 0;
        const isEditing = editId === row.spot_id;
        const catCount = Object.values(row.categories || {}).filter(Boolean).length;

        return (
          <div key={row.spot_id} style={{
            background: C.card, borderRadius: 14, marginBottom: 10, boxShadow: C.cardShadow,
            border: `1px solid ${isEditing ? C.sky : C.cardBorder}`,
            transition: "border-color 0.2s",
          }}>
            {/* Row header */}
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{spot?.display_name || `Spot #${row.spot_id}`}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {spot?.region} · {catCount} categorie{catCount !== 1 ? "ën" : ""} · {new Date(row.updated_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>

              {/* Betrouwbaarheid badge */}
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, flexShrink: 0,
                background: conf > 0.7 ? "#DCFCE7" : conf > 0.4 ? "#FEF3C7" : "#FEE2E2",
                color: conf > 0.7 ? "#166534" : conf > 0.4 ? "#92400E" : "#991B1B",
              }}>
                {Math.round(conf * 100)}%
              </span>

              {/* Acties */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => isEditing ? setEditId(null) : startEdit(row)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: isEditing ? C.creamDark : `${C.sky}15`,
                  color: isEditing ? C.muted : C.sky,
                  border: `1px solid ${isEditing ? C.cardBorder : `${C.sky}40`}`,
                }}>
                  {isEditing ? "Annuleer" : "✏️ Bewerken"}
                </button>
                <button onClick={() => deleteRow(row.spot_id, spot?.display_name || `Spot #${row.spot_id}`)} style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA",
                }}>🗑️</button>
              </div>
            </div>

            {/* Edit mode */}
            {isEditing && (
              <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "14px 16px" }}>
                {Object.entries(editCats).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: C.sky }}>{EnrichmentIcons[key]?.()}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                        {labels[key] || key}
                      </span>
                    </div>
                    <textarea
                      value={value}
                      onChange={e => setEditCats(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%", padding: "9px 12px", fontSize: 13, color: "#374151",
                        lineHeight: 1.6, background: "#F9FAFB", borderRadius: 8,
                        border: `1.5px solid ${C.cardBorder}`, outline: "none",
                        resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => saveEdit(row.spot_id, row)}
                  disabled={saving}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`,
                    color: "#fff", opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "⏳ Opslaan..." : "💾 Wijzigingen opslaan"}
                </button>
              </div>
            )}

            {/* Preview mode — categorie pills */}
            {!isEditing && (
              <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {Object.entries(row.categories || {}).filter(([, v]) => v).map(([key]) => (
                  <span key={key} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 600,
                    background: C.creamDark, color: C.muted,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ color: C.sky, opacity: 0.8, display: "inline-flex" }}>{EnrichmentIcons[key]?.()}</span>
                    {labels[key] || key}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── Content → Spots Tab ──
function SpotsTab() {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/spots?select=id,display_name,spot_type,region,latitude,longitude&order=display_name.asc&limit=5000`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    }).then(r => r.json()).then(data => {
      setSpots(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function deleteSpot(spot: any) {
    if (!confirm(`Spot "${spot.display_name}" permanent verwijderen?\n\nDit verwijdert ook alle gekoppelde user_spots, ideal_conditions en enrichment data.`)) return;
    setDeleting(spot.id);
    try {
      // Delete in juiste volgorde vanwege foreign keys
      await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/ideal_conditions?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/user_spots?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/spot_posts?spot_id=eq.${spot.id}`, { method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }),
      ]);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=eq.${spot.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (res.ok) {
        setSpots(prev => prev.filter(s => s.id !== spot.id));
        setMsg(`✓ ${spot.display_name} verwijderd`);
        setTimeout(() => setMsg(""), 3000);
      } else {
        setMsg(`❌ Verwijderen mislukt (${res.status})`);
      }
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
    setDeleting(null);
  }

  const filtered = spots.filter(s =>
    search.length < 2 || s.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.region || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Laden...</div>;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Totaal spots", value: spots.length, color: C.sky },
          { label: "Nederland", value: spots.filter(s => s.region && !s.region.includes(",")).length, color: C.green },
          { label: "Internationaal", value: spots.filter(s => s.region && s.region.includes(",")).length, color: C.navy },
        ].map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 700,
          background: msg.startsWith("✓") ? "#DCFCE7" : "#FEF2F2",
          color: msg.startsWith("✓") ? "#166534" : "#DC2626",
        }}>{msg}</div>
      )}

      <input
        placeholder={`Zoek in ${spots.length} spots...`}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 13, color: C.navy, background: C.card, outline: "none", marginBottom: 12, boxSizing: "border-box" as const }}
      />

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        {filtered.length} spot{filtered.length !== 1 ? "s" : ""} {search.length >= 2 ? "gevonden" : "totaal"}
      </div>

      <div style={{ background: C.card, borderRadius: 12, boxShadow: C.cardShadow, overflow: "hidden" }}>
        {filtered.slice(0, 200).map((spot, i) => (
          <div key={spot.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${C.cardBorder}` : "none",
          }}>
            {/* Spot type badge */}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0,
              background: spot.spot_type === "Zee" ? "#DBEAFE" : spot.spot_type === "Meer" ? "#DCFCE7" : "#FEF3C7",
              color: spot.spot_type === "Zee" ? "#1D4ED8" : spot.spot_type === "Meer" ? "#166534" : "#92400E",
            }}>{spot.spot_type || "?"}</span>

            {/* Naam + regio */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {spot.display_name}
              </div>
              {spot.region && <div style={{ fontSize: 11, color: C.muted }}>{spot.region}</div>}
            </div>

            {/* Spot ID */}
            <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>#{spot.id}</span>

            {/* Verwijder knop */}
            <button
              onClick={() => deleteSpot(spot)}
              disabled={deleting === spot.id}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA",
                opacity: deleting === spot.id ? 0.5 : 1, flexShrink: 0,
              }}
            >
              {deleting === spot.id ? "⏳" : "🗑️"}
            </button>
          </div>
        ))}
        {filtered.length > 200 && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: C.muted, textAlign: "center" as const }}>
            Verfijn de zoekopdracht om meer te zien — {filtered.length - 200} spots verborgen
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: "32px 20px", fontSize: 13, color: C.muted, textAlign: "center" as const }}>
            Geen spots gevonden
          </div>
        )}
      </div>
    </div>
  );
}


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
   MAIN ADMIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [section, setSection] = useState<"dashboard" | "gebruikers" | "alerts" | "content" | "systeem" | "financien">("dashboard");
  const [tab, setTab] = useState<"health" | "test" | "history" | "diagnose" | "users" | "stats" | "simulator" | "spots" | "moderation" | "enrichment" | "beheer" | "prompts" | "kosten" | "campagnes">("stats");
  const [flaggedPosts, setFlaggedPosts] = useState<any[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [stats, setStats] = useState({ users: 0, spots: 0, alerts: 0, alertsToday: 0 });
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [spots, setSpots] = useState<SpotInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState("go");
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [diagnoseUserId, setDiagnoseUserId] = useState<number | null>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Users tab state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userSpots, setUserSpots] = useState<any[]>([]);
  const [userPrefs, setUserPrefs] = useState<any>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [editName, setEditName] = useState("");
  const [editWindMin, setEditWindMin] = useState(12);
  const [editWindMax, setEditWindMax] = useState(28);
  const [editWelcome, setEditWelcome] = useState(false);
  const [allSpots, setAllSpots] = useState<any[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auth check
  useEffect(() => {
    if (isTokenExpired()) { window.location.href = "/login"; return; }
    setAuthorized(true);
  }, []);

  // Load admin data
  const loadData = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (token) setAdminToken(token);
      const res = await fetch("/api/admin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) { setAuthorized(false); return; }
        throw new Error(`${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      setSpots(data.spots || []);
      setHistory(data.alerts || []);
      if (data.users?.length && !selectedUser) setSelectedUser(data.users[0].id);

      const today = new Date().toISOString().split("T")[0];
      setStats({
        users: data.users?.length || 0,
        spots: data.spots?.length || 0,
        alerts: data.alerts?.length || 0,
        alertsToday: (data.alerts || []).filter((a: any) => a.created_at?.startsWith(today)).length,
      });
    } catch (e) { console.error(e); }
  }, [selectedUser]);

  // Load health data
  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const token = await getValidToken();
      const res = await fetch("/api/admin/health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (e) { console.error("Health load error:", e); }
    setHealthLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    if (authorized) { loadData(); loadHealth(); }
  }, [authorized, loadData, loadHealth]);

  // Auto-refresh health every 5 minutes
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(loadHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authorized, loadHealth]);

  // Actions
  const runPreview = async () => {
    if (!selectedUser) return;
    setLoading(true); setEvalResult(null);
    try {
      const result = await apiPost("/api/alerts/test", { action: "evaluate", userId: selectedUser });
      setEvalResult({ ...result, mode: "preview" });
      loadData();
    } catch (e: any) { setEvalResult({ error: e.message }); }
    setLoading(false);
  };

  const runLive = async () => {
    if (!selectedUser) return;
    setLoading(true); setEvalResult(null);
    try {
      const token = localStorage.getItem("wp_supabase_auth");
      const accessToken = token ? JSON.parse(token).access_token : "";
      const res = await fetch("/api/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ test: false, userId: selectedUser }),
      });
      const result = await res.json();
      setEvalResult({ ...result, mode: "live" });
      loadData(); loadHealth();
    } catch (e: any) { setEvalResult({ error: e.message }); }
    setLoading(false);
  };

  const sendTestEmail = async () => {
    if (!selectedUser) return;
    setLoading(true); setTestResult(null);
    try {
      const result = await apiPost("/api/alerts/test", { action: "send_test", userId: selectedUser, alertType: selectedAlertType, spotId: selectedSpot });
      setTestResult(result);
      loadData();
    } catch (e: any) { setTestResult({ error: e.message }); }
    setLoading(false);
  };

  const clearTestAlerts = async () => {
    setLoading(true);
    await apiPost("/api/alerts/test", { action: "clear_test" });
    loadData();
    setLoading(false);
  };

  const testPush = async () => {
    if (!selectedUser) return;
    setLoading(true); setTestResult(null);
    try {
      const result = await apiPost("/api/alerts/test", { action: "test_push", userId: selectedUser });
      setTestResult(result);
    } catch (e: any) { setTestResult({ error: e.message }); }
    setLoading(false);
  };

  if (authorized === null) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes heartPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.1; } }`}</style>
    </div>
  );

  if (!authorized) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.amber }}>
      🚫 Not authorized
    </div>
  );

  // Sidebar nav items
  const criticalCount = health?.redFlags.filter(f => f.severity === "critical").length || 0;

  const NAV = [
    { section: "dashboard" as const, icon: "🏠", label: "Dashboard", badge: 0 },
    { section: "gebruikers" as const, icon: "👥", label: "Gebruikers", badge: 0 },
    { section: "alerts" as const, icon: "🔔", label: "Alerts", badge: criticalCount },
    { section: "content" as const, icon: "✏️", label: "Content & Spots", badge: 0 },
    { section: "financien" as const, icon: "💰", label: "Financiën", badge: 0 },
    { section: "systeem" as const, icon: "⚙️", label: "Systeem", badge: 0 },
  ];

  // Sub-tabs per sectie
  const SUBTABS: Record<string, { id: string; label: string; badge?: number }[]> = {
    dashboard: [],
    gebruikers: [
      { id: "users", label: "Gebruikers" },
      { id: "stats", label: "Statistieken" },
    ],
    alerts: [
      { id: "health", label: "Health", badge: criticalCount },
      { id: "history", label: "Geschiedenis" },
      { id: "diagnose", label: "Diagnose" },
      { id: "test", label: "Testen" },
      { id: "simulator", label: "Simulator" },
    ],
    content: [
      { id: "spots", label: "Spots" },
      { id: "moderation", label: "Moderatie" },
      { id: "enrichment", label: "Spot Enrichment" },
      { id: "beheer", label: "Enrichment Beheer" },
      { id: "prompts", label: "Prompts" },
    ],
    systeem: [
      { id: "health", label: "Health" },
    ],
    financien: [
      { id: "kosten", label: "Vaste kosten" },
      { id: "campagnes", label: "Campagnes" },
    ],
  };

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes heartPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.1; } }`}</style>

      {/* ── Sidebar layout ── */}
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* Sidebar */}
        <div style={{
          width: 220, flexShrink: 0, background: C.navy,
          display: "flex", flexDirection: "column",
          padding: "0 0 24px", position: "sticky", top: 0, height: "100vh",
        }}>
          {/* Logo */}
          <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
            <div className="font-bebas" style={{ ...h, fontSize: 22, letterSpacing: 3, color: "#fff", margin: 0 }}>WINDPING</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" as const }}>Admin</div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label: "Users", value: stats.users, color: C.sky },
              { label: "Spots", value: stats.spots, color: C.sky },
              { label: "Alerts 7d", value: health?.funnel.total || stats.alerts, color: C.green },
              { label: "Vandaag", value: stats.alertsToday, color: C.gold },
            ].map(k => (
              <div key={k.label} style={{ padding: "6px 4px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto" as const }}>
            {NAV.map(item => (
              <div key={item.section}>
                <button onClick={() => {
                  setSection(item.section);
                  const subs = SUBTABS[item.section];
                  if (subs.length > 0) setTab(subs[0].id as any);
                }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: section === item.section ? "rgba(255,255,255,0.12)" : "transparent",
                  color: section === item.section ? "#fff" : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: 700, textAlign: "left" as const,
                  marginBottom: 2, transition: "all 0.15s",
                  borderLeft: `3px solid ${section === item.section ? C.sky : "transparent"}`,
                }}>
                  <span style={{ opacity: section === item.section ? 1 : 0.6 }}>{item.icon}</span>
                  {item.label}
                  {item.badge > 0 && (
                    <span style={{ marginLeft: "auto", background: "#DC2626", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</span>
                  )}
                </button>

                {/* Sub-tabs */}
                {section === item.section && SUBTABS[item.section].length > 0 && (
                  <div style={{ paddingLeft: 20, marginBottom: 4 }}>
                    {SUBTABS[item.section].map(sub => (
                      <button key={sub.id} onClick={() => setTab(sub.id as any)} style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: tab === sub.id ? `${C.sky}25` : "transparent",
                        color: tab === sub.id ? C.sky : "rgba(255,255,255,0.4)",
                        fontSize: 12, fontWeight: tab === sub.id ? 700 : 400,
                        textAlign: "left" as const, marginBottom: 1,
                      }}>
                        {sub.label}
                        {sub.badge && sub.badge > 0 ? (
                          <span style={{ marginLeft: "auto", background: "#DC2626", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{sub.badge}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <a href="/" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Terug naar app
            </a>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "28px 28px 60px", overflowY: "auto" as const }}>

          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <h1 className="font-bebas" style={{ ...h, fontSize: 26, letterSpacing: 2, margin: "0 0 2px", color: C.navy }}>
              {NAV.find(n => n.section === section)?.label || "Dashboard"}
            </h1>
            {SUBTABS[section].length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 12, background: C.creamDark, padding: 4, borderRadius: 10, width: "fit-content" }}>
                {SUBTABS[section].map(sub => (
                  <button key={sub.id} onClick={() => setTab(sub.id as any)} style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer",
                    background: tab === sub.id ? C.card : "transparent",
                    color: tab === sub.id ? C.navy : C.muted,
                    boxShadow: tab === sub.id ? C.cardShadow : "none",
                  }}>
                    {sub.label}
                    {sub.badge && sub.badge > 0 ? ` (${sub.badge})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dashboard sectie */}
          {section === "dashboard" && (
            <AdminDashboard
              stats={stats}
              health={health}
              onNavigate={(sec, tabId) => { setSection(sec as any); if (tabId) setTab(tabId as any); }}
            />
          )}

        {/* ═══ HEALTH TAB ═══ */}
        {(section === "alerts" || section === "systeem") && tab === "health" && (
          <>
            {/* Refresh bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: C.muted }}>
                Bijgewerkt: {lastRefresh.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                {" · "}Auto-refresh: 5 min
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={loadHealth} disabled={healthLoading} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  background: C.card, border: `1px solid ${C.cardBorder}`, color: C.sky,
                  cursor: "pointer", opacity: healthLoading ? 0.5 : 1,
                }}>
                  {healthLoading ? "⏳" : "🔄"} Ververs
                </button>
                <Tip text="Herlaadt alle health data: heartbeat, delivery funnel en gebruikersstatus. Gebeurt ook automatisch elke 5 minuten." />
              </div>
            </div>

            {/* Quick guide */}
            <Card style={{ marginBottom: 16, border: `1.5px solid ${C.cardBorder}`, padding: "14px 16px" }}>
              <details>
                <summary style={{ fontSize: 12, fontWeight: 700, color: C.sky, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>💡</span> Hoe lees ik dit dashboard?
                </summary>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7, marginTop: 10 }}>
                  <strong style={{ color: C.navy }}>🚩 Status</strong> — het allerbelangrijkste. Groen = alles ok. Geel = let op. Rood = actie nodig.<br/>
                  <strong style={{ color: C.navy }}>💓 Heartbeat</strong> — laat zien of de engine draait. Het groene bolletje pulseert als het systeem gezond is. Als de laatste run langer dan 8 uur geleden is, wordt het rood.<br/>
                  <strong style={{ color: C.navy }}>Recente runs</strong> — blokjes die tonen wanneer de engine draaide en hoeveel alerts hij maakte.<br/>
                  <strong style={{ color: C.navy }}>Cron schema</strong> — 4 vaste momenten per dag: 01:00, 07:00, 13:00, 19:00 NL-tijd. Vinkje = gedraaid, streepje = gemist.<br/>
                  <strong style={{ color: C.navy }}>📊 Funnel</strong> — hoeveel alerts zijn aangemaakt, hoeveel emails/push zijn daadwerkelijk bezorgd.<br/>
                  <strong style={{ color: C.navy }}>👥 Gebruikers</strong> — per gebruiker: ontvangt hij alerts? Zijn emails bezorgd? Groen bolletje = gezond.
                </div>
              </details>
            </Card>

            {healthLoading && !health ? (
              <Card style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: C.muted }}>Health data laden...</div>
              </Card>
            ) : health ? (
              <>
                {/* Red Flags — always on top */}
                <Section title={`🚩 Status (${health.redFlags.length} melding${health.redFlags.length !== 1 ? "en" : ""})`}>
                  <RedFlagsPanel flags={health.redFlags} />
                </Section>

                {/* Heartbeat */}
                <Section title="💓 Heartbeat">
                  <HeartbeatPanel heartbeat={health.heartbeat} />
                </Section>

                {/* Delivery Funnel */}
                <Section title="📊 Delivery Funnel (7 dagen)">
                  <FunnelPanel funnel={health.funnel} />
                </Section>

                {/* Per-user status */}
                <Section title={`👥 Gebruikers (${health.users.length})`} defaultOpen={false}>
                  <UserStatusPanel users={health.users} />
                </Section>
              </>
            ) : (
              <Card>
                <div style={{ fontSize: 13, color: C.amber }}>Health data kon niet worden geladen. Check de API.</div>
              </Card>
            )}
          </>
        )}

        {/* ═══ TEST TAB ═══ */}
        {section === "alerts" && tab === "test" && (
          <Section title="🧪 Test Alerts">
            <Card>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>USER</label>
                <select value={selectedUser || ""} onChange={(e) => setSelectedUser(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", background: C.card, boxShadow: C.cardShadow, borderRadius: 10, color: C.navy, fontSize: 13 }}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email} (#{u.id})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>ALERT TYPE</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["heads_up", "go", "epic", "downgrade", "alternative"] as const).map(t => (
                    <button key={t} onClick={() => setSelectedAlertType(t)} style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: selectedAlertType === t ? alertTypeColors[t] : C.creamDark,
                      color: selectedAlertType === t ? "#fff" : C.muted,
                      border: `1px solid ${selectedAlertType === t ? alertTypeColors[t] : C.cardBorder}`,
                    }}>
                      {alertTypeEmoji[t]} {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>SPOT (optional)</label>
                <select value={selectedSpot || ""} onChange={(e) => setSelectedSpot(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: "100%", padding: "10px 12px", background: C.card, boxShadow: C.cardShadow, borderRadius: 10, color: C.navy, fontSize: 13 }}>
                  <option value="">— Auto (first user spot) —</option>
                  {spots.map(s => <option key={s.id} value={s.id}>{(s as any).display_name || (s as any).name || `Spot #${s.id}`} (#{s.id})</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={sendTestEmail} disabled={loading} style={{ padding: "11px 20px", background: C.sky, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Sending..." : "📧 Send Test Email"}
                  </button>
                  <Tip text="Stuurt een nep-alert email naar de geselecteerde gebruiker. Geen echte forecast, alleen om de email layout te testen." />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={runPreview} disabled={loading} style={{ padding: "11px 20px", background: C.creamDark, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Running..." : "👁️ Preview"}
                  </button>
                  <Tip text="Evalueert de echte weersverwachting voor deze gebruiker en toont het resultaat — maar stuurt geen email of push." />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={runLive} disabled={loading} style={{ padding: "11px 20px", background: C.green, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Running..." : "🚀 Run Live"}
                  </button>
                  <Tip text="Voert een echte alert evaluatie uit én stuurt email + push notificatie als de condities kloppen. Gebruik alleen voor testen!" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={testPush} disabled={loading} style={{ padding: "8px 14px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, color: "#8B5CF6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    🔔 Test Push
                  </button>
                  <Tip text="Stuurt een test push notificatie naar het apparaat van de gebruiker. Handig om te checken of push werkt." />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={clearTestAlerts} disabled={loading} style={{ padding: "8px 14px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    🗑️ Clear Test Alerts
                  </button>
                  <Tip text="Verwijdert alle test-alerts uit de database. Gebruik dit na het testen om de alert history schoon te houden." />
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
                <strong>Send Test Email</strong> — nep-alert, stuurt alleen email<br/>
                <strong>Preview</strong> — echte forecast, toont resultaat maar stuurt niks<br/>
                <strong>Run Live</strong> — echte forecast, stuurt email + push<br/>
                <strong>Test Push</strong> — stuurt een test push notificatie
              </div>
            </Card>

            {testResult && (
              <Card style={{ marginTop: 12, border: `1.5px solid ${testResult.error ? C.amber : C.green}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: testResult.error ? C.amber : C.green, marginBottom: 6 }}>
                  {testResult.error ? "❌ Error" : "✅ Test alert created"}
                </div>
                <pre style={{ fontSize: 11, color: C.muted, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 200, overflow: "auto" }}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </Card>
            )}

            {evalResult && (
              <Card style={{ marginTop: 12, border: `1.5px solid ${evalResult.error ? C.amber : C.sky}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: evalResult.error ? C.amber : C.sky, marginBottom: 6 }}>
                  {evalResult.error ? "❌ Error" : `⚡ Evaluation: ${evalResult.alertsGenerated || 0} alerts`}
                </div>
                <pre style={{ fontSize: 11, color: C.muted, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 300, overflow: "auto" }}>
                  {JSON.stringify(evalResult, null, 2)}
                </pre>
              </Card>
            )}
          </Section>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {section === "alerts" && tab === "diagnose" && (
          <div>
            <Section title="🔍 Waarom geen alert?">
              <p style={{ fontSize: 13, color: C.sub, margin: "0 0 16px" }}>Kies een gebruiker om te zien waarom ze wel of geen alert hebben gekregen.</p>

              {/* User selector */}
              {allUsers.length === 0 ? (
                <button onClick={async () => {
                  const token = await getValidToken();
                  const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
                  const data = await res.json();
                  setAllUsers(data || []);
                }} style={{ padding: "8px 16px", background: C.sky, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                  Laad gebruikers
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {allUsers.map((u: any) => (
                    <button key={u.id} onClick={() => { setDiagnoseUserId(u.id); setDiagnoseResult(null); }} style={{
                      padding: "8px 16px", borderRadius: 10, border: "2px solid",
                      borderColor: diagnoseUserId === u.id ? C.sky : C.cardBorder,
                      background: diagnoseUserId === u.id ? `${C.sky}15` : C.card,
                      color: diagnoseUserId === u.id ? C.sky : C.navy,
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>{u.name || u.email}</button>
                  ))}
                </div>
              )}

              {diagnoseUserId && (
                <button onClick={async () => {
                  setDiagnoseLoading(true);
                  setDiagnoseResult(null);
                  try {
                    const token = await getValidToken();
                    const res = await fetch(`/api/alerts/diagnose?user_id=${diagnoseUserId}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setDiagnoseResult({ error: `HTTP ${res.status}: ${data?.error || JSON.stringify(data)}` });
                    } else {
                      setDiagnoseResult(data);
                    }
                  } catch (e: any) {
                    setDiagnoseResult({ error: e.message || "Fetch mislukt" });
                  }
                  setDiagnoseLoading(false);
                }} style={{
                  padding: "10px 20px", background: C.sky, color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  marginBottom: 20, opacity: diagnoseLoading ? 0.6 : 1,
                }}>{diagnoseLoading ? "Laden..." : "🔍 Analyseer"}</button>
              )}

              {diagnoseResult && !diagnoseResult.error && (
                <div>
                  {/* Prefs summary */}
                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>INSTELLINGEN</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.entries(diagnoseResult.prefs.availability).map(([day, avail]: [string, any]) => (
                        <span key={day} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: avail ? "#D1FAE5" : C.creamDark, color: avail ? "#065F46" : C.muted }}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </span>
                      ))}
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${C.sky}15`, color: C.sky }}>
                        {diagnoseResult.prefs.lookahead}d vooruit
                      </span>
                      {diagnoseResult.prefs.paused && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>⏸ Gepauzeerd</span>}
                    </div>
                  </Card>

                  {/* Spots */}
                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>SPOTS ({diagnoseResult.spots.length})</div>
                    {diagnoseResult.spots.map((s: any) => (
                      <div key={s.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.cardBorder}`, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: C.navy }}>{s.name}</span>
                        {s.conditions ? (
                          <span style={{ color: C.sub, marginLeft: 8 }}>
                            {s.conditions.windMin}–{s.conditions.windMax}kn · {s.conditions.directions?.join(", ") || "alle richtingen"}
                          </span>
                        ) : <span style={{ color: C.gold, marginLeft: 8 }}>Geen voorkeuren ingesteld</span>}
                      </div>
                    ))}
                  </Card>

                  {/* Per day */}
                  {diagnoseResult.days.map((day: any) => (
                    <div key={day.date} style={{
                      background: C.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10,
                      boxShadow: C.cardShadow,
                      borderLeft: `4px solid ${day.hadGo ? C.green : day.hadHeadsUp ? C.sky : day.wouldSend ? C.gold : C.cardBorder}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{day.dayLabel}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                          background: day.hadGo ? "#D1FAE5" : day.hadHeadsUp ? "#DBEAFE" : day.wouldSend ? "#FEF3C7" : C.creamDark,
                          color: day.hadGo ? "#065F46" : day.hadHeadsUp ? "#1D4ED8" : day.wouldSend ? "#D97706" : C.muted,
                        }}>
                          {day.hadGo ? "✅ Go verstuurd" : day.hadHeadsUp ? "📣 Heads-up verstuurd" : day.hadDowngrade ? "⬇️ Downgrade verstuurd" : day.wouldSend ? `⏳ Zou sturen: ${day.wouldSend}` : `❌ ${day.wouldNotSendReason || "Geen alert"}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {day.spotResults.map((s: any) => (
                          <div key={s.spotId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8,
                            background: s.inRange ? "#F0FDF4" : "#FFF7ED" }}>
                            <span>{s.inRange ? "✅" : "❌"}</span>
                            <span style={{ fontWeight: 600, fontSize: 12, color: C.navy, flex: 1 }}>{s.spotName}</span>
                            <span style={{ fontSize: 12, color: C.sub }}>{s.wind}kn {s.dir}</span>
                            {s.reasons?.length > 0 && <span style={{ fontSize: 11, color: "#EF4444" }}>{s.reasons.join(" · ")}</span>}
                            {s.error && <span style={{ fontSize: 11, color: "#EF4444" }}>{s.error}</span>}
                          </div>
                        ))}
                      </div>

                      {/* Verstuurde alerts voor deze dag */}
                      {day.sentAlerts?.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.cardBorder}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: 0.5 }}>VERSTUURDE ALERTS</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {day.sentAlerts.map((a: any, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, background: C.creamDark }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: a.alert_type === "go" ? C.green : a.alert_type === "heads_up" ? C.sky : C.gold }}>
                                  {a.alert_type === "go" ? "🟢 Go" : a.alert_type === "heads_up" ? "🔵 Heads-up" : a.alert_type === "downgrade" ? "🔴 Downgrade" : a.alert_type}
                                </span>
                                <span style={{ fontSize: 11, color: C.sub, flex: 1 }}>
                                  {new Date(a.created_at).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}
                                </span>
                                <span style={{ fontSize: 10, color: a.delivered_push ? C.green : C.muted }}>📱 {a.delivered_push ? "✓" : "—"}</span>
                                <span style={{ fontSize: 10, color: a.delivered_email ? C.green : C.muted }}>📧 {a.delivered_email ? "✓" : "—"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nog geen alert maar zou sturen */}
                      {day.wouldSend && !day.sentAlerts?.length && (
                        <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 8, background: "#FEF3C7", fontSize: 11, color: "#D97706" }}>
                          ⏳ Nog niet verstuurd — zou een <strong>{day.wouldSend}</strong> alert sturen bij volgende engine run
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {diagnoseResult?.error && (
                <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "12px 16px", color: "#DC2626", fontSize: 13, marginBottom: 12 }}>
                  ❌ Fout: {diagnoseResult.error}
                </div>
              )}
              {diagnoseResult && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>Raw API response (debug)</summary>
                  <pre style={{ fontSize: 10, color: C.sub, background: C.creamDark, padding: 10, borderRadius: 8, overflow: "auto", maxHeight: 200, marginTop: 6 }}>
                    {JSON.stringify(diagnoseResult, null, 2)}
                  </pre>
                </details>
              )}
            </Section>
          </div>
        )}

        {section === "alerts" && tab === "history" && (
          <Section title="📜 Alert History">
            {history.length === 0 ? (
              <Card><span style={{ fontSize: 13, color: C.muted }}>Geen alerts</span></Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((a) => {
                  const tc = alertTypeColors[a.alert_type] || C.muted;
                  const spots = a.conditions?.spots || [];
                  return (
                    <Card key={a.id} style={{ padding: "12px 16px", border: a.is_test ? `1.5px solid ${C.gold}40` : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{alertTypeEmoji[a.alert_type]}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: tc }}>{a.alert_type.replace("_", " ").toUpperCase()}</span>
                        {a.is_test && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${C.gold}20`, color: C.gold }}>TEST</span>}
                        <span style={{ fontSize: 10, color: C.sub, marginLeft: "auto" }}>
                          {new Date(a.created_at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        Target: <strong style={{ color: C.navy }}>{a.target_date}</strong>
                        {spots.length > 0 && <span> · {spots.map((s: any) => `${s.spotName || s.name} ${s.wind}kn ${s.dir}`).join(", ")}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: a.delivered_push ? C.green : C.sub }}>📱 Push: {a.delivered_push ? "✓" : "—"}</span>
                        <span style={{ fontSize: 10, color: a.delivered_email ? C.green : C.sub }}>📧 Email: {a.delivered_email ? "✓" : "—"}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {section === "gebruikers" && tab === "users" && (
          <div>
            <Section title="👤 Gebruikersbeheer">
              {/* User list */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <button onClick={async () => {
                    const token = await getValidToken();
                  const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
                  const data = await res.json();
                  setAllUsers(data || []);
                  }} style={{ padding: "8px 16px", background: C.sky, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Laad gebruikers
                  </button>
                  <span style={{ fontSize: 12, color: C.sub }}>{allUsers.length} gebruikers geladen</span>
                </div>

                {allUsers.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                    {allUsers.map(u => (
                      <div key={u.id} onClick={async () => {
                        setSelectedUserId(u.id);
                        setEditName(u.name || "");
                        setEditWindMin(u.min_wind_speed || 12);
                        setEditWindMax(u.max_wind_speed || 28);
                        setEditWelcome(u.welcome_shown || false);
                        setUserDetail(u);
                        setUserMsg("");
                        // Load prefs and spots
                        const [prefs, spots, spotsList] = await Promise.all([
                          sbGet(`alert_preferences?user_id=eq.${u.id}`),
                          sbGet(`user_spots?user_id=eq.${u.id}&select=spot_id,spots(id,display_name)`),
                          sbGet("spots?select=id,display_name&order=display_name.asc&limit=100"),
                        ]);
                        setUserPrefs(prefs?.[0] || null);
                        setUserSpots(spots || []);
                        setAllSpots(spotsList || []);
                      }} style={{
                        padding: "10px 14px", background: selectedUserId === u.id ? `${C.sky}15` : C.card,
                        border: `1.5px solid ${selectedUserId === u.id ? C.sky : C.cardBorder}`,
                        borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{u.name || "—"}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{u.email}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {u.subscription_status === "active" && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${C.green}20`, color: C.green, fontWeight: 700 }}>Pro</span>}
                          {u.welcome_shown && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${C.sky}20`, color: C.sky, fontWeight: 700 }}>Onboarded</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User detail editor */}
              {userDetail && (
                <div style={{ background: C.creamDark, borderRadius: 14, padding: 16, marginTop: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 14 }}>
                    ✏️ {userDetail.name || userDetail.email}
                    <span style={{ fontSize: 11, color: C.sub, fontWeight: 400, marginLeft: 8 }}>ID: {userDetail.id}</span>
                  </div>

                  {userMsg && (
                    <div style={{ padding: "8px 12px", borderRadius: 8, background: userMsg.startsWith("✓") ? `${C.green}20` : `${C.amber}20`, color: userMsg.startsWith("✓") ? C.green : C.amber, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                      {userMsg}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {/* Name */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>NAAM / DISPLAY NAME</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          style={{ flex: 1, padding: "8px 12px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, outline: "none" }} />
                        <button onClick={async () => {
                          setUserSaving(true);
                          await sbPatch(`users?id=eq.${userDetail.id}`, { name: editName });
                          setUserMsg("✓ Naam opgeslagen");
                          setUserSaving(false);
                        }} style={{ padding: "8px 14px", background: C.sky, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          Opslaan
                        </button>
                      </div>
                    </div>

                    {/* Wind min */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>MIN WIND (KN)</label>
                      <input type="number" value={editWindMin} onChange={e => setEditWindMin(Number(e.target.value))} min={5} max={50}
                        style={{ width: "100%", padding: "8px 12px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }} />
                    </div>

                    {/* Wind max */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>MAX WIND (KN)</label>
                      <input type="number" value={editWindMax} onChange={e => setEditWindMax(Number(e.target.value))} min={5} max={50}
                        style={{ width: "100%", padding: "8px 12px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }} />
                    </div>

                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                      <button onClick={async () => {
                        setUserSaving(true);
                        await sbPatch(`users?id=eq.${userDetail.id}`, { min_wind_speed: editWindMin, max_wind_speed: editWindMax });
                        setUserMsg("✓ Wind opgeslagen");
                        setUserSaving(false);
                      }} style={{ padding: "8px 14px", background: C.sky, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Wind opslaan
                      </button>
                      <button onClick={async () => {
                        setEditWindMin(12); setEditWindMax(28);
                        await sbPatch(`users?id=eq.${userDetail.id}`, { min_wind_speed: 12, max_wind_speed: 28 });
                        setUserMsg("✓ Wind naar default (12–28kn)");
                      }} style={{ padding: "8px 14px", background: C.creamDark, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Default (12–28)
                      </button>
                    </div>
                  </div>

                  {/* Welcome / onboarding flags */}
                  <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12, marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8 }}>ONBOARDING FLAGS</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={async () => {
                        await sbPatch(`users?id=eq.${userDetail.id}`, { welcome_shown: false });
                        setEditWelcome(false);
                        setUserMsg("✓ Welcome reset — ziet welkomstbericht opnieuw");
                      }} style={{ padding: "7px 14px", background: editWelcome ? `${C.amber}15` : `${C.green}15`, border: `1px solid ${editWelcome ? C.amber : C.green}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: editWelcome ? C.amber : C.green, cursor: "pointer" }}>
                        {editWelcome ? "🔄 Reset welkomstbericht" : "✓ Welkom al gezien"}
                      </button>
                      <button onClick={async () => {
                        await sbPatch(`users?id=eq.${userDetail.id}`, { welcome_shown: false });
                        if (userPrefs) {
                          await sbPatch(`alert_preferences?user_id=eq.${userDetail.id}`, {
                            available_mon: false, available_tue: false, available_wed: false,
                            available_thu: false, available_fri: false, available_sat: true, available_sun: true,
                          });
                        }
                        setEditWelcome(false); setEditWindMin(12); setEditWindMax(28);
                        await sbPatch(`users?id=eq.${userDetail.id}`, { min_wind_speed: 12, max_wind_speed: 28 });
                        setUserMsg("✓ Volledig gereset naar defaults");
                      }} style={{ padding: "7px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>
                        🔄 Reset alles naar default
                      </button>
                      <button onClick={async () => {
                        await sbPatch(`users?id=eq.${userDetail.id}`, { name: null });
                        setUserMsg("✓ Naam gewist — ga naar de homepage om onboarding te testen");
                        setTimeout(() => { window.location.href = "/"; }, 1200);
                      }} style={{ padding: "7px 14px", background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#2563EB", cursor: "pointer" }}>
                        🧪 Test onboarding (behoudt data)
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Weet je zeker dat je ALLES van ${userDetail.name || userDetail.email} wilt verwijderen? Dit reset de volledige onboarding.`)) return;
                        setUserSaving(true);
                        try {
                          await Promise.all([
                            sbDelete(`user_spots?user_id=eq.${userDetail.id}`),
                            sbDelete(`alert_preferences?user_id=eq.${userDetail.id}`),
                            sbDelete(`alert_schedules?user_id=eq.${userDetail.id}`),
                          ]);
                          await sbPatch(`users?id=eq.${userDetail.id}`, {
                            name: null,
                            min_wind_speed: null,
                            max_wind_speed: null,
                            welcome_shown: false,
                          });
                          setUserSpots([]);
                          setUserPrefs(null);
                          setEditName("");
                          setEditWindMin(12);
                          setEditWindMax(28);
                          setEditWelcome(false);
                          setUserMsg("✓ Alles verwijderd — gebruiker kan opnieuw onboarden");
                        } catch(e: any) {
                          setUserMsg("❌ Fout: " + e.message);
                        }
                        setUserSaving(false);
                      }} style={{ padding: "7px 14px", background: "#FEF2F2", border: "2px solid #DC2626", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#DC2626", cursor: "pointer" }}>
                        🗑️ Verwijder alles (onboarding reset)
                      </button>
                    </div>
                  </div>

                  {/* Spots */}
                  <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12, marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8 }}>SPOTS ({userSpots.length})</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                      {userSpots.length === 0 ? (
                        <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Geen spots</span>
                      ) : userSpots.map((us: any) => (
                        <div key={us.spot_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, borderRadius: 8 }}>
                          <span style={{ flex: 1, fontSize: 12, color: C.navy }}>{us.spots?.display_name || `Spot #${us.spot_id}`}</span>
                          <button onClick={async () => {
                            await sbDelete(`user_spots?user_id=eq.${userDetail.id}&spot_id=eq.${us.spot_id}`);
                            setUserSpots(prev => prev.filter(s => s.spot_id !== us.spot_id));
                            setUserMsg(`✓ Spot verwijderd`);
                          }} style={{ padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>
                            Verwijder
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Add spot */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <select onChange={async (e) => {
                        const spotId = Number(e.target.value);
                        if (!spotId) return;
                        await sbPost2(`user_spots`, { user_id: userDetail.id, spot_id: spotId });
                        const spot = allSpots.find(s => s.id === spotId);
                        setUserSpots(prev => [...prev, { spot_id: spotId, spots: { display_name: spot?.display_name } }]);
                        setUserMsg("✓ Spot toegevoegd");
                        e.target.value = "";
                      }} style={{ flex: 1, padding: "8px 12px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, outline: "none" }}>
                        <option value="">+ Spot toevoegen...</option>
                        {allSpots.filter(s => !userSpots.find(us => us.spot_id === s.id)).map(s => (
                          <option key={s.id} value={s.id}>{s.display_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Alert preferences summary */}
                  {userPrefs && (
                    <div style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8 }}>BESCHIKBAARHEID</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d, i) => {
                          const keys = ["available_mon","available_tue","available_wed","available_thu","available_fri","available_sat","available_sun"];
                          const active = userPrefs[keys[i]];
                          return (
                            <span key={d} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: active ? C.sky : C.creamDark, color: active ? "#fff" : C.sub }}>{d}</span>
                          );
                        })}
                      </div>
                      <button onClick={async () => {
                        await sbPatch(`alert_preferences?user_id=eq.${userDetail.id}`, {
                          available_mon: false, available_tue: false, available_wed: false,
                          available_thu: false, available_fri: false, available_sat: true, available_sun: true,
                        });
                        setUserPrefs((p: any) => ({ ...p, available_mon: false, available_tue: false, available_wed: false, available_thu: false, available_fri: false, available_sat: true, available_sun: true }));
                        setUserMsg("✓ Beschikbaarheid naar default (weekenden)");
                      }} style={{ padding: "6px 14px", background: C.creamDark, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Reset naar weekenden
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ═══ STATS TAB ═══ */}
        {section === "gebruikers" && tab === "stats" && <StatsTab token={adminToken} />}

        {/* ═══ SIMULATOR TAB ═══ */}
        {section === "alerts" && tab === "simulator" && <SimulatorTab token={adminToken} />}

        {section === "content" && tab === "moderation" && (
          <ModerationTab />
        )}

        {section === "content" && tab === "spots" && (
          <SpotsTab />
        )}

        {section === "content" && tab === "enrichment" && (
          <EnrichmentTab />
        )}

        {section === "content" && tab === "prompts" && (
          <PromptsTab />
        )}
        {section === "content" && tab === "beheer" && (
          <EnrichmentBeheerTab />
        )}

        {section === "financien" && (tab === "kosten" || tab === "campagnes") && (
          <FinancienTab tab={tab} token={adminToken} />
        )}

        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATS TAB
   ══════════════════════════════════════════════════════════════ */

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: C.creamDark, borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

function SparkBar({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {entries.map(([date, count]) => {
        const h = max > 0 ? Math.max(4, Math.round((count / max) * 40)) : 4;
        const isToday = date === new Date().toISOString().split("T")[0];
        return (
          <div key={date} title={`${date}: ${count} sessies`} style={{
            flex: 1, height: h, borderRadius: 2,
            background: isToday ? C.sky : count > 0 ? `${C.sky}60` : C.creamDark,
            transition: "height 0.4s ease",
          }} />
        );
      })}
    </div>
  );
}

function StatsTab({ token }: { token: string | null }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setStats(await res.json());
      } catch {}
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
    </div>
  );

  if (!stats) return <div style={{ color: C.amber, fontSize: 13 }}>Stats konden niet worden geladen.</div>;

  const { overview, topSpots, reactionCounts, sessionsByDay, ratingDist, topUsers } = stats;
  const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker", 5: "Epic" };
  const ratingColors: Record<number, string> = { 1: C.terra, 2: C.terra, 3: C.gold, 4: C.sky, 5: C.green };
  const maxRating = Math.max(...Object.values(ratingDist as Record<string, number>), 1);
  const maxSpot = topSpots?.[0]?.count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Overview grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Gebruikers", value: overview.totalUsers, sub: `${overview.activeUsers30d} actief (30d)`, color: C.sky },
          { label: "Sessies", value: overview.completedSessions, sub: `${overview.sessionsLast7d} deze week`, color: C.green },
          { label: "Reacties", value: overview.totalReactions, sub: "🤙 stoked", color: C.gold },
          { label: "Vriendschappen", value: overview.totalFriendships, sub: `${overview.totalSpots} spots totaal`, color: C.purple },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: item.color, fontFamily: fonts.heading, letterSpacing: 1 }}>{item.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 2 }}>{item.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Gem. rating */}
      {overview.avgRating && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, fontFamily: fonts.heading }}>{overview.avgRating}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Gemiddelde sessierating</div>
            <div style={{ fontSize: 10, color: C.muted }}>Over {overview.completedSessions} completed sessies</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 24 }}>⭐</div>
        </div>
      )}

      {/* Sessions last 14 days sparkbar */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: "0.06em" }}>SESSIES — LAATSTE 14 DAGEN</div>
        <SparkBar data={sessionsByDay} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: C.muted }}>14 dagen geleden</span>
          <span style={{ fontSize: 9, color: C.sky, fontWeight: 700 }}>Vandaag</span>
        </div>
      </div>

      {/* Top spots */}
      {topSpots?.length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>TOP SPOTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topSpots.slice(0, 8).map((spot: any, i: number) => (
              <div key={spot.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? C.gold : C.muted, width: 16 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{spot.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {spot.avgRating && <span style={{ fontSize: 10, color: C.gold }}>⭐ {spot.avgRating}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{spot.count}</span>
                  </div>
                </div>
                <MiniBar value={spot.count} max={maxSpot} color={i === 0 ? C.sky : `${C.sky}70`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating distribution */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>RATING VERDELING</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[5, 4, 3, 2, 1].map(r => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ratingColors[r], width: 40 }}>{ratingLabels[r]}</span>
              <MiniBar value={(ratingDist as any)[r] || 0} max={maxRating} color={ratingColors[r]} />
              <span style={{ fontSize: 11, color: C.muted, width: 24, textAlign: "right" }}>{(ratingDist as any)[r] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top loggers */}
      {topUsers?.length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>TOP LOGGERS</div>
          {topUsers.map((u: any, i: number) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topUsers.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <span style={{ fontSize: 14, width: 20 }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.navy }}>{u.name}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{u.count} sessies</span>
            </div>
          ))}
        </div>
      )}

      {/* Reactions */}
      {Object.keys(reactionCounts).length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: "0.06em" }}>REACTIES</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(reactionCounts).map(([type, count]) => (
              <div key={type} style={{ flex: 1, textAlign: "center", padding: "10px 8px", background: C.oceanTint, borderRadius: 10 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🤙</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.sky }}>{count as number}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>stoked</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FINANCIËN TAB
   ══════════════════════════════════════════════════════════════ */

// Vaste maandelijkse kosten — gebaseerd op bekende services
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

function SimulatorTab({ token }: { token: string | null }) {
  const [simUsers, setSimUsers] = useState<any[]>([]);
  const [simSpots, setSimSpots] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [userFriendships, setUserFriendships] = useState<any[]>([]);
  const [userFeed, setUserFeed] = useState<any[]>([]);
  const [feedFriendCount, setFeedFriendCount] = useState(0);
  const [feedDebug, setFeedDebug] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<"sessions" | "friends" | "feed" | "create">("feed");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Create session form
  const [createSpotId, setCreateSpotId] = useState<number | null>(null);
  const [createStatus, setCreateStatus] = useState("completed");
  const [createRating, setCreateRating] = useState<number>(4);
  const [createWind, setCreateWind] = useState<number>(18);
  const [createDir, setCreateDir] = useState("SW");
  const [createGearType, setCreateGearType] = useState("kite twintip");
  const [createGearSize, setCreateGearSize] = useState("9");
  const [createNotes, setCreateNotes] = useState("");
  const [createDate, setCreateDate] = useState(new Date().toISOString().split("T")[0]);
  const [createPhotoUrl, setCreatePhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Add friend form
  const [friendTargetId, setFriendTargetId] = useState<number | null>(null);

  async function adminFetch(url: string) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    return res.json();
  }

  async function adminPost(url: string, body: any) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function adminDelete(url: string) {
    const t = token || (await import("@/lib/supabase").then(m => m.getValidToken()))
    await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
  }

  useEffect(() => {
    async function load() {
      const [usersRes, spotsRes] = await Promise.all([
        adminFetch("/api/admin/simulate?action=users"),
        adminFetch("/api/admin/simulate?action=spots"),
      ]);
      setSimUsers(usersRes.users || []);
      setSimSpots(spotsRes.spots || []);
      if (usersRes.users?.length) setCreateSpotId(null);
    }
    load();
  }, []);

  async function selectUser(user: any) {
    setSelectedUser(user);
    setMsg("");
    setLoading(true);
    const [sessRes, friendRes, feedRes] = await Promise.all([
      adminFetch(`/api/admin/simulate?action=user_sessions&user_id=${user.id}`),
      adminFetch(`/api/admin/simulate?action=user_friendships&user_id=${user.id}`),
      adminFetch(`/api/admin/simulate?action=user_feed&user_id=${user.id}`),
    ]);
    setUserSessions(sessRes.sessions || []);
    setUserFriendships(friendRes.friendships || []);
    setUserFeed(feedRes.feed || []);
    setFeedFriendCount(feedRes.friendCount || 0);
    setFeedDebug(feedRes.debug || null);
    setLoading(false);
  }

  async function createSession() {
    if (!selectedUser || !createSpotId) return;
    setLoading(true);
    const res = await adminPost("/api/admin/simulate", {
      action: "create_session",
      userId: selectedUser.id,
      spotId: createSpotId,
      sessionDate: createDate,
      status: createStatus,
      rating: createStatus === "completed" ? createRating : null,
      gearType: createGearType || null,
      gearSize: createGearSize || null,
      forecastWind: createWind,
      forecastDir: createDir,
      notes: createNotes || null,
      photoUrl: createPhotoUrl || null,
    });
    if (res.error) { setMsg("❌ " + res.error); }
    else { setMsg("✓ Sessie aangemaakt! Push verstuurd naar vrienden."); setCreatePhotoUrl(null); await selectUser(selectedUser); setActivePanel("sessions"); }
    setLoading(false);
  }

  async function deleteSession(id: number) {
    if (!confirm("Sessie verwijderen?")) return;
    await adminDelete(`/api/admin/simulate?action=session&id=${id}`);
    setUserSessions(prev => prev.filter(s => s.id !== id));
    setMsg("✓ Sessie verwijderd");
  }

  async function createFriendship() {
    if (!selectedUser || !friendTargetId) return;
    setLoading(true);
    const res = await adminPost("/api/admin/simulate", {
      action: "create_friendship",
      userId1: selectedUser.id,
      userId2: friendTargetId,
    });
    if (res.error) setMsg("❌ " + res.error);
    else { setMsg("✓ Vriendschap aangemaakt!"); await selectUser(selectedUser); }
    setLoading(false);
  }

  async function deleteFriendship(id: number) {
    await adminDelete(`/api/admin/simulate?action=friendship&id=${id}`);
    setUserFriendships(prev => prev.filter(f => f.id !== id));
    setMsg("✓ Vriendschap verwijderd");
  }

  const ratingLabels: Record<number, string> = { 1: "Shit 😬", 2: "Mwah 😐", 3: "Oké 👌", 4: "Lekker 😎", 5: "EPIC 🤙" };
  const [spotSearch, setSpotSearch] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* User picker */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8, letterSpacing: "0.06em" }}>SELECTEER GEBRUIKER</div>
        <select
          value={selectedUser?.id || ""}
          onChange={e => {
            const user = simUsers.find(u => u.id === Number(e.target.value));
            if (user) selectUser(user);
          }}
          style={{ width: "100%", padding: "10px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 13, color: C.navy, outline: "none" }}
        >
          <option value="">Kies gebruiker...</option>
          {simUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name || u.email?.split("@")[0] || "?"} — {u.email}
            </option>
          ))}
        </select>
      </div>

      {/* Panel */}
      {selectedUser && (
        <div style={{ background: C.card, borderRadius: 14, boxShadow: C.cardShadow, overflow: "hidden" }}>

          {/* Context header */}
          <div style={{ padding: "12px 16px", background: `${C.sky}10`, borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.sky}, ${C.skyDark || C.navy})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(selectedUser.name || selectedUser.email || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{selectedUser.name || selectedUser.email}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {userFriendships.filter(f => f.status === "accepted").length} vrienden
                {userFriendships.filter(f => f.status === "accepted").length > 0 && (
                  <span> — {userFriendships.filter(f => f.status === "accepted").map((f: any) => f.friendName).join(", ")}</span>
                )}
                {" · "}
                {userSessions.length} sessies
              </div>
            </div>
          </div>

          {/* Panel tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.cardBorder}` }}>
            {([
              { id: "feed" as const,     label: `👁️ Feed (${feedFriendCount} vrienden)` },
              { id: "sessions" as const, label: `📋 Sessies (${userSessions.length})` },
              { id: "friends" as const,  label: `🤝 Vrienden (${userFriendships.filter(f => f.status === "accepted").length})` },
              { id: "create" as const,   label: "➕ Simuleer" },
            ]).map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)} style={{
                flex: 1, padding: "10px 4px", fontSize: 11, fontWeight: 700,
                background: activePanel === p.id ? C.cream : "transparent",
                color: activePanel === p.id ? C.sky : C.muted,
                border: "none", cursor: "pointer",
                borderBottom: activePanel === p.id ? `2px solid ${C.sky}` : "2px solid transparent",
              }}>{p.label}</button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {msg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600,
                background: msg.startsWith("✓") ? `${C.green}15` : `${C.terra}15`,
                color: msg.startsWith("✓") ? C.green : C.terra,
              }}>{msg}</div>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ width: 20, height: 20, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
              </div>
            )}

            {/* FEED PANEL */}
            {!loading && activePanel === "feed" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 8, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  👁️ <strong>Feed viewer</strong> — Dit is exact wat {selectedUser.name || selectedUser.email} ziet op zijn homepage. Handig om te controleren of sessies van vrienden correct verschijnen.
                </div>
                {feedDebug && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, padding: "6px 10px", background: C.creamDark, borderRadius: 6 }}>
                    Debug: {feedDebug.totalFriendships} vriendschappen totaal · {feedDebug.acceptedFriendships} accepted · {feedDebug.sessionCount ?? 0} sessies gevonden (laatste 90 dagen)
                  </div>
                )}
                {feedFriendCount === 0 && (
                  <div style={{ color: C.amber, fontSize: 12, marginBottom: 10 }}>
                    ⚠️ Geen vrienden — voeg vrienden toe via het 🤝 tabblad om de feed te testen.
                  </div>
                )}
                {userFeed.length === 0 && feedFriendCount > 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>
                    Vrienden hebben de afgelopen 90 dagen geen sessies gelogd. Maak er een aan via ➕ Simuleer.
                  </div>
                ) : userFeed.map((item: any) => (
                  <div key={item.id} style={{ padding: "10px 12px", background: C.creamDark, borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.friendName} · {item.spotName}</div>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, fontWeight: 700,
                        background: item.status === "completed" ? `${C.green}20` : `${C.sky}20`,
                        color: item.status === "completed" ? C.green : C.sky,
                      }}>{item.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {item.sessionDate} · {item.forecastWind}kn {item.forecastDir}
                      {item.gearType && ` · ${item.gearType}`}
                      {item.rating && ` · ${ratingLabels[item.rating]}`}
                    </div>
                    {item.notes && <div style={{ fontSize: 11, color: C.sub, marginTop: 4, fontStyle: "italic" }}>{item.notes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* SESSIONS PANEL */}
            {!loading && activePanel === "sessions" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  📋 <strong>Sessies</strong> — Alle sessies van deze gebruiker. Je kunt sessies verwijderen of nieuwe aanmaken via ➕ Simuleer. Gesimuleerde sessies verschijnen direct in de feed van vrienden.
                </div>
                {userSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Geen sessies</div>
                ) : userSessions.map((s: any) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{s.spotName || s.spots?.display_name || `Spot #${s.spot_id}`}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {s.session_date} · {s.status}
                        {s.forecast_wind && ` · ${s.forecast_wind}kn`}
                        {s.gear_type && ` · ${s.gear_type}`}
                        {s.rating && ` · ${ratingLabels[s.rating]}`}
                      </div>
                      {s.notes && <div style={{ fontSize: 11, color: C.sub, fontStyle: "italic" }}>{s.notes}</div>}
                    </div>
                    <button onClick={() => deleteSession(s.id)} style={{ padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* FRIENDS PANEL */}
            {!loading && activePanel === "friends" && (
              <div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, padding: "8px 12px", background: C.oceanTint, borderRadius: 8 }}>
                  🤝 <strong>Vrienden</strong> — Beheer vriendschappen voor deze gebruiker. Maak een vriendschap aan om de feed te testen: koppel twee gebruikers en maak dan via ➕ Simuleer een sessie aan namens de vriend. Die sessie verschijnt dan in de feed.
                </div>
                {/* Add friendship */}
                <div style={{ marginBottom: 14, padding: "12px", background: C.creamDark, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>VRIENDSCHAP AANMAKEN</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={friendTargetId || ""} onChange={e => setFriendTargetId(Number(e.target.value))}
                      style={{ flex: 1, padding: "8px 10px", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12, color: C.navy }}>
                      <option value="">Kies gebruiker...</option>
                      {simUsers.filter(u => u.id !== selectedUser.id).map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <button onClick={createFriendship} disabled={!friendTargetId || loading} style={{ padding: "8px 14px", background: C.sky, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Toevoegen
                    </button>
                  </div>
                </div>

                {userFriendships.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Geen vriendschappen</div>
                ) : userFriendships.map((f: any) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{f.friendName}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{f.status}</div>
                    </div>
                    <button onClick={() => deleteFriendship(f.id)} style={{ padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CREATE SESSION PANEL */}
            {!loading && activePanel === "create" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, color: C.sub }}>
                  Maak een sessie aan namens <strong style={{ color: C.navy }}>{selectedUser.name || selectedUser.email}</strong>.
                  Deze verschijnt direct in de feed van zijn vrienden.
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>SPOT</label>
                  <input
                    type="text"
                    placeholder="Zoek spot... (200 beschikbaar)"
                    value={spotSearch}
                    onChange={e => { setSpotSearch(e.target.value); setCreateSpotId(null); }}
                    style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${createSpotId ? C.green : C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }}
                  />
                  {spotSearch.length >= 2 && !createSpotId && (
                    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                      {simSpots.filter(s => s.display_name.toLowerCase().includes(spotSearch.toLowerCase())).slice(0, 8).map(s => (
                        <div key={s.id} onClick={() => { setCreateSpotId(s.id); setSpotSearch(s.display_name); }}
                          style={{ padding: "8px 12px", fontSize: 13, color: C.navy, cursor: "pointer", borderBottom: `1px solid ${C.cardBorder}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.creamDark)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >{s.display_name}</div>
                      ))}
                      {simSpots.filter(s => s.display_name.toLowerCase().includes(spotSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: "8px 12px", fontSize: 12, color: C.muted }}>Geen resultaten</div>
                      )}
                    </div>
                  )}
                  {createSpotId && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ Spot geselecteerd (ID: {createSpotId})</div>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>DATUM</label>
                    <input type="date" value={createDate} onChange={e => setCreateDate(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>STATUS</label>
                    <select value={createStatus} onChange={e => setCreateStatus(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      <option value="completed">completed</option>
                      <option value="going">going</option>
                    </select>
                  </div>
                </div>

                {createStatus === "completed" && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>RATING</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(r => (
                        <button key={r} onClick={() => setCreateRating(r)} style={{
                          flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                          background: createRating === r ? C.sky : C.creamDark,
                          color: createRating === r ? "#fff" : C.muted,
                        }}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>WIND (KN)</label>
                    <input type="number" value={createWind} onChange={e => setCreateWind(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>RICHTING</label>
                    <select value={createDir} onChange={e => setCreateDir(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      {["N","NE","E","SE","S","SW","W","NW"].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>GEAR TYPE</label>
                    <select value={createGearType} onChange={e => setCreateGearType(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy }}>
                      <option value="kite twintip">kite twintip</option>
                      <option value="kite surfboard">kite surfboard</option>
                      <option value="kite foil">kite foil</option>
                      <option value="windsurf">windsurf</option>
                      <option value="wingfoil">wingfoil</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>MAAT</label>
                    <input value={createGearSize} onChange={e => setCreateGearSize(e.target.value)} placeholder="bijv. 9"
                      style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>FOTO (optioneel)</label>
                  {createPhotoUrl ? (
                    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                      <img src={createPhotoUrl} alt="Sessie foto" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                      <button onClick={() => setCreatePhotoUrl(null)} style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ) : (
                    <div onClick={() => document.getElementById("sim-photo-upload")?.click()}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px", borderRadius: 10, border: `2px dashed ${C.cardBorder}`, background: C.creamDark, cursor: "pointer", fontSize: 13, color: C.muted }}>
                      {photoUploading ? "⏳ Uploaden..." : "📷 Klik om foto toe te voegen"}
                    </div>
                  )}
                  <input id="sim-photo-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoUploading(true);
                    const fd = new FormData(); fd.append("file", file);
                    try {
                      const res = await fetch("/api/upload", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.url) setCreatePhotoUrl(data.url);
                      else setMsg("❌ Foto upload mislukt");
                    } catch { setMsg("❌ Foto upload mislukt"); }
                    setPhotoUploading(false);
                    e.target.value = "";
                  }} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>NOTITIE (optioneel)</label>
                  <input value={createNotes} onChange={e => setCreateNotes(e.target.value)} placeholder="Super sessie!"
                    style={{ width: "100%", padding: "8px 12px", background: C.creamDark, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 13, color: C.navy, boxSizing: "border-box" }} />
                </div>

                <button onClick={createSession} disabled={!createSpotId || loading} style={{
                  width: "100%", padding: "12px", background: C.green, color: "#fff", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: createSpotId ? "pointer" : "not-allowed", opacity: createSpotId ? 1 : 0.5,
                }}>
                  {loading ? "Aanmaken..." : `✓ Sessie aanmaken namens ${selectedUser.name || selectedUser.email}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}