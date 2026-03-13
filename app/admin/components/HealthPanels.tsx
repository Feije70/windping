"use client";
import { C } from "../lib/constants";
import { alertTypeColors, alertTypeEmoji, severityStyles } from "../lib/constants";
import { HealthData } from "../lib/types";
import { Card } from "./SharedUI";

export function HeartbeatPanel({ heartbeat }: { heartbeat: HealthData["heartbeat"] }) {
  const statusColors = { healthy: C.green, warning: C.gold, critical: "#DC2626", unknown: C.muted };
  const statusLabels = { healthy: "Gezond", warning: "Let op", critical: "Kritiek", unknown: "Onbekend" };
  const statusColor = statusColors[heartbeat.status];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${statusColor}15`, position: "absolute", animation: heartbeat.status === "healthy" ? "heartPulse 2s ease-in-out infinite" : "none" }} />
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: statusColor, position: "relative", zIndex: 1 }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>{statusLabels[heartbeat.status]}</div>
          <div style={{ fontSize: 12, color: C.sub }}>
            {heartbeat.lastRun ? `Laatste run: ${new Date(heartbeat.lastRun).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}` : "Geen runs gevonden"}
          </div>
          {heartbeat.hoursSinceLastRun !== null && (
            <div style={{ fontSize: 11, color: heartbeat.hoursSinceLastRun > 7 ? "#DC2626" : C.muted, fontWeight: heartbeat.hoursSinceLastRun > 7 ? 700 : 400 }}>
              {heartbeat.hoursSinceLastRun < 1 ? `${Math.round(heartbeat.hoursSinceLastRun * 60)} minuten geleden` : `${heartbeat.hoursSinceLastRun} uur geleden`}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8 }}>RECENTE RUNS</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {heartbeat.recentRuns.slice(0, 8).map((run, i) => {
          const d = new Date(run.timestamp);
          const label = d.toLocaleString("nl-NL", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
          return (
            <div key={i} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, background: i === 0 ? `${C.green}15` : C.creamDark, color: i === 0 ? C.green : C.sub, border: `1px solid ${i === 0 ? `${C.green}30` : C.cardBorder}` }}>
              {label} · {run.alertCount} alert{run.alertCount !== 1 ? "s" : ""}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 6 }}>CRON SCHEMA (UTC)</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 6, 12, 18].map(hour => {
          const ran = heartbeat.recentRuns.some(r => { const d = new Date(r.timestamp); return d.toDateString() === new Date().toDateString() && d.getUTCHours() === hour; });
          return (
            <div key={hour} style={{ flex: 1, padding: "8px 0", borderRadius: 8, textAlign: "center", background: ran ? `${C.green}12` : `${C.amber}08`, border: `1.5px solid ${ran ? C.green : `${C.amber}40`}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ran ? C.green : C.amber }}>{ran ? "✓" : "—"}</div>
              <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{String(hour).padStart(2, "0")}:00</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function FunnelPanel({ funnel }: { funnel: HealthData["funnel"] }) {
  const emailRate = funnel.total > 0 ? Math.round((funnel.emailSent / funnel.total) * 100) : 0;
  const pushRate = funnel.total > 0 ? Math.round((funnel.pushSent / funnel.total) * 100) : 0;
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10 }}>LAATSTE 7 DAGEN</div>
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(funnel.byType).filter(([, v]) => v > 0).map(([type, count]) => (
          <div key={type} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${alertTypeColors[type] || C.muted}15`, color: alertTypeColors[type] || C.muted }}>
            {alertTypeEmoji[type]} {type}: {count}
          </div>
        ))}
      </div>
      {funnel.errors.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FCA5A5" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>Delivery errors ({funnel.errors.length})</div>
          {funnel.errors.slice(0, 3).map((e: any, i: number) => <div key={i} style={{ fontSize: 10, color: "#7F1D1D", marginBottom: 2 }}>{e.error}</div>)}
        </div>
      )}
    </Card>
  );
}

export function UserStatusPanel({ users }: { users: HealthData["users"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {users.map(u => {
        const isHealthy = u.totalAlerts7d > 0 && u.emailDelivered7d > 0;
        const isWarning = u.daysSinceAlert !== null && u.daysSinceAlert > 3 && !u.isPaused;
        const statusColor = u.isPaused ? C.gold : isWarning ? C.amber : isHealthy ? C.green : C.muted;
        return (
          <Card key={u.id} style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0, boxShadow: isHealthy ? `0 0 6px ${C.green}60` : "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{u.name}</div>
                <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {u.isPaused && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${C.gold}20`, color: C.gold }}>PAUSED</span>}
                {u.notifyEmail && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: `${C.green}12`, color: C.green }}>📧</span>}
                {u.notifyPush && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: `${C.purple || "#8B5CF6"}12`, color: C.purple || "#8B5CF6" }}>📱</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: C.sub }}>
              <span>📅 {u.availableDays} dagen</span>
              <span>🔔 {u.totalAlerts7d} alerts/7d</span>
              <span>📧 {u.emailDelivered7d} email/7d</span>
              <span>📱 {u.pushDelivered7d} push/7d</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              {u.lastAlertAt ? `Laatste alert: ${new Date(u.lastAlertAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })} (${u.lastAlertType})` : "Nog geen alerts ontvangen"}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function RedFlagsPanel({ flags }: { flags: HealthData["redFlags"] }) {
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
