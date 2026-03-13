"use client";

import { useEffect, useState, useCallback } from "react";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, getEmail, getAuthId, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

// Lib
import { sbGet, sbPatch, sbDelete, sbPost2, apiPost } from "./lib/helpers";
import { alertTypeColors, alertTypeEmoji, h } from "./lib/constants";
import type { AlertHistoryItem, UserInfo, SpotInfo, HealthData } from "./lib/types";

// Components
import { Section, Card, Tip } from "./components/SharedUI";
import { HeartbeatPanel, FunnelPanel, UserStatusPanel, RedFlagsPanel } from "./components/HealthPanels";
import { AdminDashboard } from "./components/AdminDashboard";
import { EnrichmentCronPanel } from "./components/EnrichmentCronPanel";
import { EnrichmentTab } from "./components/EnrichmentTab";
import { EnrichmentBeheerTab } from "./components/EnrichmentBeheerTab";
import { EnrichmentResult } from "./components/EnrichmentResult";
import { SpotsTab } from "./components/SpotsTab";
import { ModerationTab } from "./components/ModerationTab";
import { PromptsTab } from "./components/PromptsTab";
import { StatsTab } from "./components/StatsTab";
import { FinancienTab } from "./components/FinancienTab";
import { SimulatorTab } from "./components/SimulatorTab";

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

                {/* Enrichment Crons */}
                <Section title="⚙️ Enrichment Crons" defaultOpen={true}>
                  <EnrichmentCronPanel />
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

