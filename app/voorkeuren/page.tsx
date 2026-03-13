"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { Icons } from "@/components/Icons";
import { useUser } from "@/lib/hooks/useUser";
import { clearAuth, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

/* ── Supabase helpers ── */
function makeSb(token: string) {
  return async function sb(path: string, opts?: { method?: string; body?: unknown }) {
    const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" };
    if (opts?.method === "POST") headers.Prefer = "resolution=merge-duplicates,return=minimal";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: opts?.method || "GET", headers, body: opts?.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok) throw new Error(`supabase_${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
}

/* ── Constants ── */
const SMIN = 5, SMAX = 50, MIN_C = -10, MAX_C = 35;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PERIODS = ["morning", "afternoon", "evening"] as const;
const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

/* ── Wind Range Slider ── */
function WindRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);

  function pct(v: number) { return ((v - SMIN) / (SMAX - SMIN)) * 100; }
  function val(p: number) { return Math.round(SMIN + (p / 100) * (SMAX - SMIN)); }

  function handleMove(clientX: number) {
    if (!dragging.current || !trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const v = val(p);
    if (dragging.current === "min") onChange(Math.min(v, max - 1), max);
    else onChange(min, Math.max(v, min + 1));
  }

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      handleMove(cx);
    };
    const onUp = () => { dragging.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  });

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.sky }}>{min}</div>
          <div style={{ fontSize: 10, color: C.sub, textTransform: "uppercase" }}>Min knots</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.sky }}>{max}</div>
          <div style={{ fontSize: 10, color: C.sub, textTransform: "uppercase" }}>Max knots</div>
        </div>
      </div>
      <div ref={trackRef} style={{ position: "relative", width: "100%", height: 8, background: C.creamDark, borderRadius: 4, margin: "16px 0", cursor: "pointer" }}
        onClick={(e) => {
          const r = trackRef.current!.getBoundingClientRect();
          const p = ((e.clientX - r.left) / r.width) * 100;
          const v = val(p);
          if (Math.abs(v - min) < Math.abs(v - max)) onChange(Math.min(v, max - 1), max);
          else onChange(min, Math.max(v, min + 1));
        }}
      >
        <div style={{ position: "absolute", height: "100%", left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%`, background: `linear-gradient(90deg, ${C.sky}, #4DB8C9)`, borderRadius: 4 }} />
        {(["min", "max"] as const).map((which) => (
          <div key={which}
            onMouseDown={(e) => { e.preventDefault(); dragging.current = which; }}
            onTouchStart={(e) => { e.preventDefault(); dragging.current = which; }}
            style={{
              position: "absolute", top: "50%", left: `${pct(which === "min" ? min : max)}%`,
              width: 28, height: 28, background: C.sky, border: "3px solid #fff", borderRadius: "50%",
              transform: "translate(-50%, -50%)", cursor: "grab", boxShadow: `0 2px 8px rgba(0,0,0,0.3)`, zIndex: 2, touchAction: "none",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub }}>
        <span>{SMIN} kn</span><span>{SMAX} kn</span>
      </div>
    </div>
  );
}

/* ── Temperature Control ── */
function TempControl({ value, enabled, unit, onValueChange, onToggle, onUnitChange }: {
  value: number; enabled: boolean; unit: "C" | "F";
  onValueChange: (v: number) => void; onToggle: (on: boolean) => void; onUnitChange: (u: "C" | "F") => void;
}) {
  const cToF = (c: number) => Math.round(c * 9 / 5 + 32);
  const display = unit === "C" ? value : cToF(value);
  const pct = Math.max(2, Math.min(100, ((value - MIN_C) / (MAX_C - MIN_C)) * 100));

  function getColor() {
    if (value <= 0) return { bg: "rgba(59,130,246,0.15)", border: `${C.sky}40`, text: "#60A5FA" };
    if (value <= 10) return { bg: "rgba(16,185,129,0.15)", border: `${C.green}40`, text: C.green };
    if (value <= 20) return { bg: "rgba(245,158,11,0.15)", border: `${C.gold}40`, text: C.gold };
    return { bg: "rgba(201,122,99,0.15)", border: `${C.amber}40`, text: C.amber };
  }
  const col = getColor();

  function adj(d: number) {
    if (!enabled) return;
    const n = Math.max(MIN_C, Math.min(MAX_C, value + d));
    onValueChange(n);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? C.sky : C.sub }}>
          {enabled ? "Temperature filter on" : "Temperature filter off"}
        </span>
        <div onClick={() => onToggle(!enabled)} style={{ width: 48, height: 26, borderRadius: 13, background: enabled ? C.sky : C.creamDark, cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
          <div style={{ position: "absolute", top: 3, left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.3s" }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16, opacity: enabled ? 1 : 0.3, transition: "opacity 0.3s", pointerEvents: enabled ? "auto" : "none" }}>
        <button onClick={() => adj(-1)} style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${C.cardBorder}`, background: C.card, fontSize: 22, fontWeight: 700, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
        <div style={{ width: 120, height: 72, borderRadius: 16, background: col.bg, border: `2px solid ${col.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {value <= 0 && <span style={{ position: "absolute", top: 8, left: 10, opacity: 0.6 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" /><line x1="18.4" y1="5.6" x2="5.6" y2="18.4" /><line x1="12" y1="2" x2="9" y2="5" /><line x1="12" y1="2" x2="15" y2="5" /><line x1="12" y1="22" x2="9" y2="19" /><line x1="12" y1="22" x2="15" y2="19" /></svg></span>}
          {value >= 20 && <span style={{ position: "absolute", top: 8, right: 10, opacity: 0.6 }}>{Icons.sun({ color: C.gold, size: 16 })}</span>}
          <span style={{ fontSize: 32, fontWeight: 900, color: col.text }}>{display}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: col.text, marginLeft: 2 }}>°{unit}</span>
        </div>
        <button onClick={() => adj(1)} style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${C.cardBorder}`, background: C.card, fontSize: 22, fontWeight: 700, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>
      <div style={{ height: 6, background: C.creamDark, borderRadius: 3, marginBottom: 8, overflow: "hidden", opacity: enabled ? 1 : 0.3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, #60A5FA, ${col.text})`, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub, marginBottom: 12, opacity: enabled ? 1 : 0.3 }}>
        <span>{unit === "C" ? MIN_C : cToF(MIN_C)}°</span>
        <span>{unit === "C" ? MAX_C : cToF(MAX_C)}°</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, opacity: enabled ? 1 : 0.3 }}>
        {(["C", "F"] as const).map((u) => (
          <button key={u} onClick={() => onUnitChange(u)} style={{ padding: "5px 14px", borderRadius: 8, border: `1.5px solid ${unit === u ? C.sky : C.cardBorder}`, background: unit === u ? C.sky : "transparent", color: unit === u ? "#fff" : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>°{u}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Schedule Grid ── */
function ScheduleGrid({ schedule, onChange }: {
  schedule: Record<number, Record<string, boolean>>;
  onChange: (day: number, period: string) => void;
}) {
  function quickSelect(preset: string) {
    for (let d = 0; d < 7; d++) {
      for (const p of PERIODS) {
        const current = schedule[d]?.[p] || false;
        let target = false;
        if (preset === "weekends") target = d >= 5;
        else if (preset === "evenings") target = p === "evening";
        else if (preset === "all") target = true;
        if (current !== target) onChange(d, p);
      }
    }
  }

  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "20px 16px", boxShadow: C.cardShadow }}>
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 1fr", gap: 8, marginBottom: 10, paddingBottom: 12, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div />
        {PERIODS.map((p) => (
          <div key={p} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {p === "morning" ? Icons.sunrise({ color: C.gold, size: 20 }) : p === "afternoon" ? Icons.sun({ color: C.gold, size: 20 }) : Icons.sunset({ color: C.gold, size: 20 })}
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8 }}>{PERIOD_LABELS[p]}</div>
          </div>
        ))}
      </div>
      {DAYS.map((day, d) => (
        <div key={d}>
          {d === 5 && <div style={{ height: 1, background: `${C.sky}20`, margin: "6px 0" }} />}
          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: d >= 5 ? C.sky : "#fff", display: "flex", alignItems: "center", height: 44 }}>{day}</span>
            {PERIODS.map((p) => {
              const active = schedule[d]?.[p] || false;
              return (
                <div key={p} onClick={() => onChange(d, p)} style={{ height: 44, borderRadius: 12, cursor: "pointer", position: "relative", overflow: "hidden", background: active ? `linear-gradient(135deg, ${C.sky}, #4DB8C9)` : C.creamDark, border: active ? "none" : `1px solid ${C.cardBorder}`, boxShadow: active ? `0 3px 12px ${C.sky}40` : "none", transition: "all 0.25s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {active && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {[{ label: "Weekends", preset: "weekends" }, { label: "Evenings", preset: "evenings" }, { label: "All", preset: "all" }, { label: "Reset", preset: "none" }].map((q) => (
          <button key={q.preset} onClick={() => quickSelect(q.preset)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{q.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Section Card ── */
function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {icon}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 14, paddingLeft: 34 }}>{subtitle}</p>
      <div style={{ background: C.card, borderRadius: 18, padding: "20px 18px", boxShadow: C.cardShadow }}>
        {children}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SettingsPage() {
  const { user, token, loading: authLoading } = useUser({ redirectIfUnauthenticated: true });

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [wMin, setWMin] = useState(15);
  const [wMax, setWMax] = useState(25);
  const [tempC, setTempC] = useState(10);
  const [tempEnabled, setTempEnabled] = useState(true);
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [schedule, setSchedule] = useState<Record<number, Record<string, boolean>>>({});
  const [lookahead, setLookahead] = useState(3);
  const [epicAnyDay, setEpicAnyDay] = useState(false);
  const [pushStatus, setPushStatus] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [toast, setToast] = useState("");
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // Check push notification status on mount
  useEffect(() => {
    const checkPush = async () => {
      const hasNotification = "Notification" in window;
      const hasSW = "serviceWorker" in navigator;
      const isPWA = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
      if (!hasNotification || !hasSW) {
        setPushStatus(isPWA ? "default" : "unsupported");
        return;
      }
      const permission = Notification.permission as "default" | "granted" | "denied";
      setPushStatus(permission);
      if (permission === "granted") {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub && token) {
            const subJson = existingSub.toJSON();
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ endpoint: subJson.endpoint, keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth } }),
            });
          }
        } catch (e) { console.error("Auto-save push sub:", e); }
      }
    };
    if (token) checkPush();
  }, [token]);

  const handlePushToggle = async () => {
    if (pushStatus === "denied" || !token) return;
    if (pushStatus === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushStatus("default");
        showToast("Push notifications disabled");
      } catch (e) { console.error("Unsubscribe error:", e); }
      return;
    }
    try {
      if (!("Notification" in window)) { showToast("Push not supported — open via homescreen"); return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushStatus(permission as "default" | "denied"); if (permission === "denied") showToast("Push blocked — check app settings"); return; }
      setPushStatus("granted");
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) applicationServerKey[i] = rawData.charCodeAt(i);
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const subJson = sub.toJSON();
      const saveRes = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint: subJson.endpoint, keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth } }) });
      showToast(saveRes.ok ? "Push notifications enabled! 🔔" : "Push enabled but save failed — try again");
    } catch (e: any) { console.error("Subscribe error:", e); showToast("Could not enable push notifications"); }
  };

  // Auto-save with debounce
  const scheduleSave = useCallback((type: "wind" | "temp" | "schedule" | "alertPrefs", data?: any) => {
    if (!token || !user) return;
    const sb = makeSb(token);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (type === "wind") {
          await sb(`users?auth_id=eq.${encodeURIComponent(user.auth_id)}`, { method: "PATCH", body: { min_wind_speed: data.min, max_wind_speed: data.max } });
        } else if (type === "temp") {
          await sb(`users?auth_id=eq.${encodeURIComponent(user.auth_id)}`, { method: "PATCH", body: { min_temperature: data.enabled ? data.value : null, temp_unit: data.unit } });
        } else if (type === "schedule") {
          const rows = Object.entries(data).map(([day, periods]: [string, any]) => ({
            user_id: user.id, day_of_week: parseInt(day),
            morning: periods.morning || false, afternoon: periods.afternoon || false, evening: periods.evening || false,
          }));
          await sb("alert_schedules?on_conflict=user_id,day_of_week", { method: "POST", body: rows });
        } else if (type === "alertPrefs") {
          await sb(`alert_preferences?user_id=eq.${user.id}`, { method: "PATCH", body: { lookahead_days: data.lookahead, epic_any_day: data.epicAnyDay, updated_at: new Date().toISOString() } });
        }
        showToast("✓ Saved");
      } catch { showToast("Save failed"); }
    }, 800);
  }, [token, user]);

  // Load data
  useEffect(() => {
    if (!user || !token) return;
    const sb = makeSb(token);
    async function load() {
      try {
        if (user!.name) setDisplayName(user!.name);
        setWMin(user!.min_wind_speed);
        setWMax(user!.max_wind_speed ?? user!.min_wind_speed + 10);

        // min_temperature and temp_unit not in WindPingUser interface — fetch separately
        const extra = await sb(`users?id=eq.${user!.id}&select=min_temperature,temp_unit`);
        if (extra?.[0]) {
          if (extra[0].min_temperature != null) { setTempC(extra[0].min_temperature); setTempEnabled(true); }
          else setTempEnabled(false);
          if (extra[0].temp_unit === "F") setTempUnit("F");
        }

        // Schedule
        const schData = await sb(`alert_schedules?user_id=eq.${user!.id}`);
        const sch: Record<number, Record<string, boolean>> = {};
        for (let d = 0; d < 7; d++) sch[d] = { morning: false, afternoon: false, evening: false };
        if (schData?.length) {
          for (const row of schData) {
            sch[row.day_of_week] = { morning: row.morning || false, afternoon: row.afternoon || false, evening: row.evening || false };
          }
        }
        setSchedule(sch);

        // Alert preferences
        try {
          const apData = await sb(`alert_preferences?user_id=eq.${user!.id}`);
          if (apData?.length) {
            if (apData[0].lookahead_days != null) setLookahead(apData[0].lookahead_days);
            if (apData[0].epic_any_day != null) setEpicAnyDay(apData[0].epic_any_day);
          }
        } catch {}
      } catch (e) { console.warn("Settings load error:", e); }
      setLoading(false);
    }
    load();
  }, [user, token]);

  if (authLoading) return null;

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 100px" }}>
        <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 2, color: C.navy, margin: "0 0 6px" }}>Settings</h1>
        <p style={{ fontSize: 12, color: C.sub, marginBottom: 28 }}>Your default preferences for new spots and alerts.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <div style={{ fontSize: 13, color: C.sub, marginTop: 10 }}>Loading preferences...</div>
          </div>
        ) : (
          <>
            {/* Profile Name */}
            <div style={{ marginBottom: 20, padding: "14px 16px", background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👤 Your name</div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={async () => {
                  if (user && token && displayName.trim()) {
                    await makeSb(token)(`users?id=eq.${user.id}`, { method: "PATCH", body: { name: displayName.trim() } });
                    showToast("Name saved");
                  }
                }}
                placeholder="Je naam"
                style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.navy, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Wind Range */}
            <Section icon={Icons.wind({ color: C.sky })} title="Default Wind Range" subtitle="Applied as default when you save a new spot.">
              <WindRange min={wMin} max={wMax} onChange={(mn, mx) => { setWMin(mn); setWMax(mx); scheduleSave("wind", { min: mn, max: mx }); }} />
            </Section>

            {/* Temperature */}
            <Section icon={Icons.thermometer({ color: C.sky })} title="Minimum Temperature" subtitle="Only get alerts when it's warm enough for you.">
              <TempControl
                value={tempC} enabled={tempEnabled} unit={tempUnit}
                onValueChange={(v) => { setTempC(v); scheduleSave("temp", { value: v, enabled: tempEnabled, unit: tempUnit }); }}
                onToggle={(on) => { setTempEnabled(on); scheduleSave("temp", { value: tempC, enabled: on, unit: tempUnit }); }}
                onUnitChange={(u) => { setTempUnit(u); scheduleSave("temp", { value: tempC, enabled: tempEnabled, unit: u }); }}
              />
            </Section>

            {/* Availability Schedule */}
            <Section icon={Icons.calendar({ color: C.sky })} title="Your Availability" subtitle="When can you go out? We'll only alert you during these times.">
              <ScheduleGrid
                schedule={schedule}
                onChange={(day, period) => {
                  setSchedule((prev) => {
                    const next = { ...prev, [day]: { ...prev[day], [period]: !prev[day]?.[period] } };
                    scheduleSave("schedule", next);
                    return next;
                  });
                }}
              />
            </Section>

            {/* Alert Settings */}
            <Section icon={Icons.bell({ color: C.sky })} title="Alert Preferences" subtitle="How and when W. Ping notifies you.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "14px 16px", background: C.oceanTint, borderRadius: 12, border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 Push Notifications</div>
                      <div style={{ fontSize: 11, color: C.sub }}>
                        {pushStatus === "granted" ? "Enabled — you'll get pinged!" : pushStatus === "denied" ? "Blocked in browser settings" : pushStatus === "unsupported" ? "Open via homescreen to enable" : "Get real-time alerts on your phone"}
                      </div>
                    </div>
                    <button onClick={handlePushToggle} disabled={pushStatus === "denied"} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: pushStatus === "denied" ? "not-allowed" : "pointer", background: pushStatus === "granted" ? C.sky : C.creamDark, position: "relative", transition: "background 0.2s", opacity: pushStatus === "denied" ? 0.4 : 1 }}>
                      <div style={{ position: "absolute", top: 2, left: pushStatus === "granted" ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                    </button>
                  </div>
                  {pushStatus === "denied" && <div style={{ fontSize: 10, color: C.amber, marginTop: 6 }}>Open je browser/app instellingen om meldingen toe te staan</div>}
                </div>

                <div style={{ padding: "14px 16px", background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Days ahead</div>
                      <div style={{ fontSize: 11, color: C.sub }}>How far ahead should we look?</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.sky }}>{lookahead}d</div>
                  </div>
                  <input type="range" min={1} max={7} step={1} value={lookahead} onChange={(e) => { const v = parseInt(e.target.value); setLookahead(v); scheduleSave("alertPrefs", { lookahead: v, epicAnyDay }); }} style={{ width: "100%" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.sub, marginTop: 4 }}>
                    <span>1 day</span><span>7 days</span>
                  </div>
                </div>

                <div style={{ padding: "14px 16px", background: C.epicBg, borderRadius: 12, border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>🤙 Call in Sick mode</div>
                      <div style={{ fontSize: 11, color: C.sub }}>Get Epic alerts even on days you&apos;re not available</div>
                    </div>
                    <button onClick={() => { const v = !epicAnyDay; setEpicAnyDay(v); scheduleSave("alertPrefs", { lookahead, epicAnyDay: v }); }} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: epicAnyDay ? C.gold : C.creamDark, position: "relative", transition: "background 0.2s" }}>
                      <div style={{ position: "absolute", top: 2, left: epicAnyDay ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            {/* Logout */}
            <div style={{ padding: "16px 0 24px" }}>
              <button onClick={async () => { await clearAuth(); window.location.href = "/login"; }} style={{ width: "100%", padding: "13px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {Icons.logout({ color: C.muted, size: 16 })} Log out
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: toast.includes("✓") ? C.green : C.amber, color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 10000 }}>{toast}</div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}