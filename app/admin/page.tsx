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

/* ══════════════════════════════════════════════════════════════
   MAIN ADMIN PAGE
   ══════════════════════════════════════════════════════════════ */

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"health" | "test" | "history" | "diagnose" | "users" | "stats" | "simulator">("stats");
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
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.creamDark, padding: 4, borderRadius: 12, flexWrap: "wrap" }}>
          {([
            { id: "stats" as const,     label: "📊 Stats",      badge: 0 },
            { id: "simulator" as const, label: "🎮 Simulator",  badge: 0 },
            { id: "health" as const,    label: "🩺 Health",     badge: health?.redFlags.filter(f => f.severity === "critical").length || 0 },
            { id: "test" as const,      label: "🧪 Test",       badge: 0 },
            { id: "diagnose" as const,  label: "🔍 Diagnose",   badge: 0 },
            { id: "history" as const,   label: "📜 History",    badge: 0 },
            { id: "users" as const,     label: "👤 Gebruikers", badge: 0 },
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
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === "diagnose" && (
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

        {tab === "users" && (
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
        {tab === "stats" && <StatsTab token={adminToken} />}

        {/* ═══ SIMULATOR TAB ═══ */}
        {tab === "simulator" && <SimulatorTab token={adminToken} />}

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