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

/* ══════════════════════════════════════════════════════════════
   MAIN ADMIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"health" | "test" | "history">("health");
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
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Test session state
  const [sessionSpot, setSessionSpot] = useState<number | null>(null);
  const [sessionDate, setSessionDate] = useState<"today" | "yesterday" | "2daysago">("yesterday");
  const [sessionWind, setSessionWind] = useState(18);
  const [sessionDir, setSessionDir] = useState("SW");
  const [sessionResult, setSessionResult] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (isTokenExpired()) { window.location.href = "/login"; return; }
    setAuthorized(true);
  }, []);

  // Load admin data
  const loadData = useCallback(async () => {
    try {
      const token = await getValidToken();
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

  const createTestSession = async () => {
    if (!selectedUser || !sessionSpot) return;
    setSessionLoading(true);
    setSessionResult(null);
    try {
      const token = await getValidToken();
      const now = new Date();
      const d = new Date(now);
      if (sessionDate === "yesterday") d.setDate(d.getDate() - 1);
      else if (sessionDate === "2daysago") d.setDate(d.getDate() - 2);
      const dateStr = d.toISOString().split("T")[0];

      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          created_by: selectedUser,
          spot_id: sessionSpot,
          session_date: dateStr,
          status: "going",
          forecast_wind: sessionWind,
          forecast_dir: sessionDir,
          going_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionResult({ success: true, session: data[0] || data, message: `Test sessie aangemaakt voor ${dateStr}. Ga naar /sessie om te loggen.` });
      } else {
        setSessionResult({ error: JSON.stringify(data) });
      }
    } catch (e: any) {
      setSessionResult({ error: e.message });
    }
    setSessionLoading(false);
  };

  const clearTestSessions = async () => {
    if (!selectedUser) return;
    setSessionLoading(true);
    try {
      const token = await getValidToken();
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${selectedUser}&status=eq.going`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      setSessionResult({ success: true, message: "Test sessies verwijderd." });
    } catch (e: any) {
      setSessionResult({ error: e.message });
    }
    setSessionLoading(false);
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

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes heartPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.1; } }`}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 3, margin: 0 }}>WINDPING ADMIN</h1>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Alert Engine & Health Monitor</p>
          </div>
          <a href="/" style={{ fontSize: 12, color: C.sky, textDecoration: "none" }}>← Terug</a>
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.creamDark, padding: 4, borderRadius: 12 }}>
          {([
            { id: "health" as const, label: "🩺 Health", badge: health?.redFlags.filter(f => f.severity === "critical").length || 0 },
            { id: "test" as const, label: "🧪 Test", badge: 0 },
            { id: "history" as const, label: "📜 History", badge: 0 },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", position: "relative",
              background: tab === t.id ? C.card : "transparent",
              color: tab === t.id ? C.navy : C.muted,
              boxShadow: tab === t.id ? C.cardShadow : "none",
            }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: "20%", width: 16, height: 16, borderRadius: "50%",
                  background: "#DC2626", color: "#fff", fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Quick stats bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <StatBox label="Users" value={stats.users} />
          <StatBox label="Spots" value={stats.spots} />
          <StatBox label="Alerts (7d)" value={health?.funnel.total || stats.alerts} color={C.green} />
          <StatBox label="Vandaag" value={stats.alertsToday} color={C.gold} />
        </div>

        {/* ═══ HEALTH TAB ═══ */}
        {tab === "health" && (
          <>
            {/* Refresh bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: C.muted }}>
                Bijgewerkt: {lastRefresh.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                {" · "}Auto-refresh: 5 min
              </span>
              <button onClick={loadHealth} disabled={healthLoading} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: C.card, border: `1px solid ${C.cardBorder}`, color: C.sky,
                cursor: "pointer", opacity: healthLoading ? 0.5 : 1,
              }}>
                {healthLoading ? "⏳" : "🔄"} Ververs
              </button>
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
        {tab === "test" && (
          <>
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
                <button onClick={sendTestEmail} disabled={loading} style={{ padding: "11px 20px", background: C.sky, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Sending..." : "📧 Send Test Email"}
                </button>
                <button onClick={runPreview} disabled={loading} style={{ padding: "11px 20px", background: C.creamDark, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Running..." : "👁️ Preview"}
                </button>
                <button onClick={runLive} disabled={loading} style={{ padding: "11px 20px", background: C.green, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Running..." : "🚀 Run Live"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={testPush} disabled={loading} style={{ padding: "8px 14px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, color: "#8B5CF6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  🔔 Test Push
                </button>
                <button onClick={clearTestAlerts} disabled={loading} style={{ padding: "8px 14px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  🗑️ Clear Test Alerts
                </button>
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

          {/* ── TEST SESSIE ── */}
          <Section title="🏄 Test Sessie" defaultOpen={true}>
            <Card>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 14, padding: "10px 12px", background: C.oceanTint, borderRadius: 8 }}>
                Maak een nep-sessie aan met status <strong style={{ color: C.navy }}>&quot;going&quot;</strong> zodat je <strong style={{ color: C.navy }}>/sessie</strong> kunt testen zonder een echte alert te hoeven ontvangen.
              </div>

              {/* User */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>USER</label>
                <select value={selectedUser || ""} onChange={(e) => setSelectedUser(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", background: C.card, boxShadow: C.cardShadow, borderRadius: 10, color: C.navy, fontSize: 13 }}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email} (#{u.id})</option>)}
                </select>
              </div>

              {/* Spot */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>SPOT</label>
                <select value={sessionSpot || ""} onChange={(e) => setSessionSpot(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: "100%", padding: "10px 12px", background: C.card, boxShadow: C.cardShadow, borderRadius: 10, color: C.navy, fontSize: 13 }}>
                  <option value="">— Kies een spot —</option>
                  {spots.map(s => <option key={s.id} value={s.id}>{(s as any).display_name || (s as any).name || `Spot #${s.id}`} (#{s.id})</option>)}
                </select>
              </div>

              {/* Datum */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>SESSIEDATUM</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    ["today", "Vandaag"],
                    ["yesterday", "Gisteren"],
                    ["2daysago", "Eergisteren"],
                  ] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setSessionDate(val)} style={{
                      flex: 1, padding: "9px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: sessionDate === val ? C.sky : C.creamDark,
                      color: sessionDate === val ? "#fff" : C.muted,
                      border: `1px solid ${sessionDate === val ? C.sky : C.cardBorder}`,
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Wind + richting */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>WIND (kn)</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[12, 15, 18, 22, 25, 30].map(w => (
                      <button key={w} onClick={() => setSessionWind(w)} style={{
                        padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: sessionWind === w ? C.green : C.creamDark,
                        color: sessionWind === w ? "#fff" : C.muted,
                        border: `1px solid ${sessionWind === w ? C.green : C.cardBorder}`,
                      }}>{w}</button>
                    ))}
                  </div>
                </div>
                <div style={{ width: 80 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>RICHTING</label>
                  <select value={sessionDir} onChange={e => setSessionDir(e.target.value)}
                    style={{ width: "100%", padding: "8px 8px", background: C.card, boxShadow: C.cardShadow, borderRadius: 8, color: C.navy, fontSize: 13 }}>
                    {["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={createTestSession}
                  disabled={sessionLoading || !selectedUser || !sessionSpot}
                  style={{
                    flex: 1, padding: "11px 0", background: C.green, border: "none", borderRadius: 10,
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: (!selectedUser || !sessionSpot) ? "not-allowed" : "pointer",
                    opacity: (!selectedUser || !sessionSpot || sessionLoading) ? 0.5 : 1,
                  }}>
                  {sessionLoading ? "Aanmaken..." : "🏄 Maak test sessie"}
                </button>
                <a href="/sessie" target="_blank" style={{
                  padding: "11px 16px", background: C.sky, border: "none", borderRadius: 10,
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none",
                  display: "flex", alignItems: "center",
                }}>
                  Open /sessie →
                </a>
              </div>

              <button
                onClick={clearTestSessions}
                disabled={sessionLoading || !selectedUser}
                style={{
                  width: "100%", marginTop: 8, padding: "8px", background: C.card,
                  border: `1px solid ${C.cardBorder}`, borderRadius: 8, color: C.muted,
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                🗑️ Verwijder openstaande test sessies
              </button>

              {sessionResult && (
                <div style={{
                  marginTop: 12, padding: "12px 14px", borderRadius: 10,
                  background: sessionResult.error ? "#FEF2F2" : `${C.green}10`,
                  border: `1px solid ${sessionResult.error ? "#FCA5A5" : `${C.green}30`}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sessionResult.error ? "#DC2626" : C.green, marginBottom: sessionResult.session ? 6 : 0 }}>
                    {sessionResult.error ? "❌ Error" : "✅ " + sessionResult.message}
                  </div>
                  {sessionResult.session && (
                    <pre style={{ fontSize: 10, color: C.muted, margin: 0, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(sessionResult.session, null, 2)}
                    </pre>
                  )}
                  {sessionResult.error && (
                    <div style={{ fontSize: 11, color: "#DC2626" }}>{sessionResult.error}</div>
                  )}
                </div>
              )}
            </Card>
          </Section>
          </> // closes fragment + tab === "test"
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === "history" && (
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
      </div>
    </div>
  );
}