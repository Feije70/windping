"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Icons } from "@/components/Icons";

const h = { fontFamily: fonts.heading };

/* ── Constants ── */
const SMIN = 5, SMAX = 50;

/* ── Schedule Grid ── */
const DAYS_GRID = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const PERIODS_GRID = ["morning", "afternoon", "evening"] as const;
const PERIOD_LABELS: Record<string, string> = { morning: "Ochtend", afternoon: "Middag", evening: "Avond" };

function PeriodIcon({ period, active }: { period: string; active: boolean }) {
  const color = active ? "#fff" : "#F59E0B";
  if (period === "morning") return Icons.sunrise({ color, size: 20 });
  if (period === "afternoon") return Icons.sun({ color, size: 20 });
  return Icons.sunset({ color, size: 20 });
}

function ScheduleGrid({ schedule, onChange }: {
  schedule: Record<number, Record<string, boolean>>;
  onChange: (day: number, period: string) => void;
}) {
  function quickSelect(preset: string) {
    for (let d = 0; d < 7; d++) {
      for (const p of PERIODS_GRID) {
        const current = schedule[d]?.[p] || false;
        let target = false;
        if (preset === "weekdays") target = d < 5;
        else if (preset === "weekends") target = d >= 5;
        else if (preset === "evenings") target = p === "evening";
        else if (preset === "all") target = true;
        if (current !== target) onChange(d, p);
      }
    }
  }
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "16px 14px", boxShadow: "0 1px 6px rgba(31,53,76,0.08)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr", gap: 6, marginBottom: 8, paddingBottom: 10, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div />
        {PERIODS_GRID.map((p) => (
          <div key={p} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <PeriodIcon period={p} active={false} />
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>{PERIOD_LABELS[p]}</div>
          </div>
        ))}
      </div>
      {DAYS_GRID.map((day, d) => (
        <div key={d}>
          {d === 5 && <div style={{ height: 1, background: `${C.sky}20`, margin: "4px 0" }} />}
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: d >= 5 ? C.sky : C.navy, display: "flex", alignItems: "center", height: 38 }}>{day}</span>
            {PERIODS_GRID.map((p) => {
              const active = schedule[d]?.[p] || false;
              return (
                <div key={p} onClick={() => onChange(d, p)} style={{ height: 38, borderRadius: 10, cursor: "pointer", background: active ? `linear-gradient(135deg, ${C.sky}, #4DB8C9)` : C.creamDark, border: active ? "none" : `1px solid ${C.cardBorder}`, boxShadow: active ? `0 2px 8px ${C.sky}30` : "none", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {active && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {[{ label: "Doordeweeks", preset: "weekdays" }, { label: "Weekends", preset: "weekends" }, { label: "Avonden", preset: "evenings" }, { label: "Alle dagen", preset: "all" }, { label: "Reset", preset: "none" }].map((q) => (
          <button key={q.preset} onClick={() => quickSelect(q.preset)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{q.label}</button>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { num: 1, label: "Naam" },
  { num: 2, label: "Wanneer" },
  { num: 3, label: "Wind" },
  { num: 4, label: "Spots" },
  { num: 5, label: "Ping" },
];

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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.sky, lineHeight: 1 }}>{min}</div>
          <div style={{ fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Min knots</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", color: C.sub, fontSize: 20 }}>—</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: C.sky, lineHeight: 1 }}>{max}</div>
          <div style={{ fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Max knots</div>
        </div>
      </div>
      <div ref={trackRef} style={{ position: "relative", width: "100%", height: 10, background: C.creamDark, borderRadius: 5, margin: "20px 0", cursor: "pointer" }}
        onClick={(e) => {
          const r = trackRef.current!.getBoundingClientRect();
          const p = ((e.clientX - r.left) / r.width) * 100;
          const v = val(p);
          if (Math.abs(v - min) < Math.abs(v - max)) onChange(Math.min(v, max - 1), max);
          else onChange(min, Math.max(v, min + 1));
        }}
      >
        <div style={{ position: "absolute", height: "100%", left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%`, background: `linear-gradient(90deg, ${C.sky}, #4DB8C9)`, borderRadius: 5 }} />
        {(["min", "max"] as const).map((which) => (
          <div key={which}
            onMouseDown={(e) => { e.preventDefault(); dragging.current = which; }}
            onTouchStart={(e) => { e.preventDefault(); dragging.current = which; }}
            style={{ position: "absolute", top: "50%", left: `${pct(which === "min" ? min : max)}%`, width: 32, height: 32, background: "#fff", border: `3px solid ${C.sky}`, borderRadius: "50%", transform: "translate(-50%, -50%)", cursor: "grab", boxShadow: `0 2px 12px rgba(0,0,0,0.15)`, zIndex: 2, touchAction: "none" }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub }}>
        <span>{SMIN} kn</span><span>{SMAX} kn</span>
      </div>
    </div>
  );
}

/* ── Progress Bar ── */
function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 36, gap: 0 }}>
      {STEPS.map((s, i) => (
        <div key={s.num} style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: step > s.num ? C.green : step === s.num ? C.sky : "#E8E0D5", color: step >= s.num ? "#fff" : C.sub, transition: "all 0.3s" }}>
              {step > s.num ? "✓" : s.num}
            </div>
            <div style={{ fontSize: 9, color: step === s.num ? C.sky : C.sub, fontWeight: step === s.num ? 700 : 400, marginTop: 4, whiteSpace: "nowrap" }}>{s.label}</div>
          </div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.num ? C.green : "#E8E0D5", margin: "0 3px", marginBottom: 18, transition: "background 0.3s" }} />}
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ── */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useUser({ redirectIfUnauthenticated: true });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<Record<number, Record<string, boolean>>>(() => {
    const s: Record<number, Record<string, boolean>> = {};
    for (let d = 0; d < 7; d++) s[d] = { morning: d >= 5, afternoon: d >= 5, evening: d >= 5 };
    return s;
  });
  const [wMin, setWMin] = useState(12);
  const [wMax, setWMax] = useState(28);
  const [hasSpots, setHasSpots] = useState(false);
  const [pushStatus, setPushStatus] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;
    async function load() {
      if (user!.name) setName(user!.name);
      if (user!.min_wind_speed) setWMin(user!.min_wind_speed);
      if (user!.max_wind_speed) setWMax(user!.max_wind_speed);

      const spotsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_spots?user_id=eq.${user!.id}&select=spot_id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const spots = await spotsRes.json();
      setHasSpots((spots || []).length > 0);

      if ("Notification" in window) setPushStatus(Notification.permission as any);
      else setPushStatus("unsupported");

      setDataLoading(false);
    }
    load();
  }, [user, token]);

  async function sbPatch(path: string, body: any) {
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
  }

  async function sbPost(path: string, body: any) {
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(body),
    });
  }

  const saveStep1 = async () => {
    if (!user || name.trim().length < 2) return;
    setSaving(true);
    await sbPatch(`users?id=eq.${user.id}`, { name: name.trim() });
    setSaving(false);
    setStep(2);
  };

  const saveStep2 = async () => {
    if (!user) return;
    setSaving(true);
    const availMap: Record<string, boolean> = {
      available_mon: Object.values(schedule[0] || {}).some(Boolean),
      available_tue: Object.values(schedule[1] || {}).some(Boolean),
      available_wed: Object.values(schedule[2] || {}).some(Boolean),
      available_thu: Object.values(schedule[3] || {}).some(Boolean),
      available_fri: Object.values(schedule[4] || {}).some(Boolean),
      available_sat: Object.values(schedule[5] || {}).some(Boolean),
      available_sun: Object.values(schedule[6] || {}).some(Boolean),
    };
    await sbPost(`alert_preferences?user_id=eq.${user.id}`, { user_id: user.id, ...availMap, lookahead_days: 2, notify_email: true, notify_push: false, updated_at: new Date().toISOString() });
    const rows = Array.from({ length: 7 }, (_, d) => ({ user_id: user.id, day_of_week: d, morning: schedule[d]?.morning || false, afternoon: schedule[d]?.afternoon || false, evening: schedule[d]?.evening || false }));
    await sbPost("alert_schedules?on_conflict=user_id,day_of_week", rows);
    setSaving(false);
    setStep(3);
  };

  const saveStep3 = async () => {
    if (!user) return;
    setSaving(true);
    await sbPatch(`users?id=eq.${user.id}`, { min_wind_speed: wMin, max_wind_speed: wMax });
    setSaving(false);
    setStep(4);
  };

  const handlePush = async () => {
    if (!("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission as any);
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const appKey = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) appKey[i] = rawData.charCodeAt(i);
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
        const subJson = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: subJson.endpoint, keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth } }),
        });
        if (user) await sbPatch(`alert_preferences?user_id=eq.${user.id}`, { notify_push: true });
      }
    } catch (e) { console.error(e); }
  };

  const handleScheduleChange = (day: number, period: string) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [period]: !prev[day]?.[period] } }));
  };

  const scheduleHasSelection = Object.values(schedule).some(day => Object.values(day).some(Boolean));

  if (authLoading || dataLoading) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 80px" }}>

        <div style={{ textAlign: "center", padding: "36px 0 28px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.sky, letterSpacing: 3, marginBottom: 10 }}>WINDPING</div>
          <h1 style={{ ...h, fontSize: 30, fontWeight: 800, color: C.navy, margin: "0 0 6px" }}>Even instellen 🤙</h1>
          <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>Duurt minder dan 2 minuten.</p>
        </div>

        <ProgressBar step={step} />

        {/* ── Stap 1: Naam ── */}
        {step === 1 && (
          <div>
            <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 6px" }}>Hoe wil je gezien worden?</h2>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 6px", lineHeight: 1.6 }}>Dit zien je mede-WindPingers in de feed.</p>
            <p style={{ fontSize: 12, color: C.sub, margin: "0 0 24px", fontStyle: "italic" }}>Gebruik je echte naam of een bijnaam — jouw keuze.</p>
            <div style={{ background: C.card, borderRadius: 18, padding: "20px", boxShadow: "0 1px 6px rgba(31,53,76,0.08)", marginBottom: 24 }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && name.trim().length >= 2 && saveStep1()} placeholder="bijv. Feije, Kiter070, SurfDude..." autoFocus
                style={{ width: "100%", padding: "14px 16px", background: C.cream, border: `2px solid ${name.trim().length >= 2 ? C.sky : C.cardBorder}`, borderRadius: 12, color: C.navy, fontSize: 16, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} />
              {name.trim().length >= 2 && <div style={{ fontSize: 12, color: C.green, marginTop: 8, fontWeight: 600 }}>👋 Hey {name.trim()}!</div>}
            </div>
            <button onClick={saveStep1} disabled={name.trim().length < 2 || saving} style={{ width: "100%", padding: "15px", background: name.trim().length >= 2 ? C.sky : "#E8E0D5", color: name.trim().length >= 2 ? "#fff" : C.sub, border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: name.trim().length >= 2 ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: name.trim().length >= 2 ? `0 4px 16px ${C.sky}30` : "none" }}>
              {saving ? "Opslaan..." : "Volgende →"}
            </button>
          </div>
        )}

        {/* ── Stap 2: Beschikbaarheid ── */}
        {step === 2 && (
          <div>
            <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 6px" }}>Op welke dagen kun je het water op?</h2>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 24px", lineHeight: 1.6 }}>We sturen alleen alerts op dagen én tijden dat jij beschikbaar bent.</p>
            <div style={{ marginBottom: 24 }}>
              <ScheduleGrid schedule={schedule} onChange={handleScheduleChange} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: "15px 18px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>←</button>
              <button onClick={saveStep2} disabled={saving || !scheduleHasSelection} style={{ flex: 1, padding: "15px", background: scheduleHasSelection ? C.sky : "#E8E0D5", color: scheduleHasSelection ? "#fff" : C.sub, border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: scheduleHasSelection ? "pointer" : "not-allowed", boxShadow: scheduleHasSelection ? `0 4px 16px ${C.sky}30` : "none" }}>
                {saving ? "Opslaan..." : "Volgende →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Stap 3: Wind ── */}
        {step === 3 && (
          <div>
            <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 6px" }}>Bij welke wind ga jij het water op?</h2>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 6px", lineHeight: 1.6 }}>Sleep de bolletjes naar jouw ideale windrange.</p>
            <p style={{ fontSize: 12, color: C.sub, margin: "0 0 24px", fontStyle: "italic" }}>Dit is je standaard. Per spot kun je dit later verfijnen.</p>
            <div style={{ background: C.card, borderRadius: 18, padding: "24px 20px", boxShadow: "0 1px 6px rgba(31,53,76,0.08)", marginBottom: 24 }}>
              <WindRange min={wMin} max={wMax} onChange={(mn, mx) => { setWMin(mn); setWMax(mx); }} />
            </div>
            <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", marginBottom: 24, boxShadow: "0 1px 4px rgba(31,53,76,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Referentie</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[{ range: "8–12 kn", label: "Licht — grotere maat kite/zeil/wing" }, { range: "12–20 kn", label: "Matig — ideaal voor de meeste sessies" }, { range: "20–30 kn", label: "Sterk — kleinere maat kite/zeil/wing" }, { range: "30+ kn", label: "Storm — voor de echte hardcore riders" }].map(r => (
                  <div key={r.range} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.sky, minWidth: 60 }}>{r.range}</span>
                    <span style={{ fontSize: 11, color: C.sub }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ padding: "15px 18px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>←</button>
              <button onClick={saveStep3} disabled={saving} style={{ flex: 1, padding: "15px", background: C.sky, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${C.sky}30` }}>
                {saving ? "Opslaan..." : "Volgende →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Stap 4: Spots ── */}
        {step === 4 && (
          <div>
            <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 6px" }}>Voeg je spots toe</h2>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 24px", lineHeight: 1.6 }}>Kies de spots waar jij graag surft, kitet of wingt. We checken de wind voor jou.</p>
            <div style={{ background: C.card, borderRadius: 18, padding: "28px 20px", boxShadow: "0 1px 6px rgba(31,53,76,0.08)", marginBottom: 20, textAlign: "center" }}>
              {hasSpots ? (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Spots toegevoegd!</div>
                  <div style={{ fontSize: 13, color: C.sub }}>Je kunt altijd meer spots toevoegen via het menu.</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📍</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen spots</div>
                  <div style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.6 }}>Zonder spots kunnen we geen alerts sturen. Voeg nu je favoriete spot toe.</div>
                  <a href="/spots?from=onboarding" style={{ display: "inline-block", padding: "12px 28px", background: C.sky, color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: `0 4px 16px ${C.sky}30` }}>+ Spots toevoegen</a>
                </div>
              )}
            </div>
            {!hasSpots && <div style={{ background: "#FEF3C7", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#92400E" }}>💡 Je kunt dit overslaan maar ontvangt dan geen alerts totdat je een spot hebt toegevoegd.</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={{ padding: "15px 18px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>←</button>
              <button onClick={() => setStep(5)} style={{ flex: 1, padding: "15px", background: hasSpots ? C.sky : "#E8E0D5", color: hasSpots ? "#fff" : C.sub, border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: hasSpots ? `0 4px 16px ${C.sky}30` : "none" }}>
                {hasSpots ? "Volgende →" : "Overslaan →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Stap 5: Notificaties ── */}
        {step === 5 && (
          <div>
            <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 6px" }}>Zet je ping aan 🔔</h2>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 8px", lineHeight: 1.6 }}>Zo mis je nooit een perfecte winddag.</p>
            <p style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, margin: "0 0 24px" }}>⚠️ Zonder notificaties mis je mogelijk de perfecte sessie.</p>
            <div style={{ background: C.card, borderRadius: 18, padding: "28px 20px", boxShadow: "0 1px 6px rgba(31,53,76,0.08)", marginBottom: 20, textAlign: "center" }}>
              {pushStatus === "granted" ? (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>🔔</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 6 }}>Notificaties aan!</div>
                  <div style={{ fontSize: 13, color: C.sub }}>We pingen je als het waait op jouw spots.</div>
                </div>
              ) : pushStatus === "denied" ? (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>🔕</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Geblokkeerd</div>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>Zet meldingen aan via je browser- of telefooninstellingen en kom terug.</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>🤙</div>
                  <div style={{ fontSize: 14, color: C.sub, marginBottom: 20, lineHeight: 1.6 }}>Je krijgt alleen een ping als het écht goed is op jouw spots. Geen spam, beloofd.</div>
                  <button onClick={handlePush} style={{ padding: "14px 36px", background: C.sky, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px ${C.sky}40` }}>🔔 Sta notificaties toe</button>
                </div>
              )}
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: C.sub, margin: "0 0 14px", fontStyle: "italic" }}>
              Je kunt alle instellingen later altijd aanpassen via <a href="/voorkeuren" style={{ color: C.sky, textDecoration: "none", fontWeight: 600 }}>Instellingen</a>.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(4)} style={{ padding: "15px 18px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>←</button>
              <button onClick={() => router.push("/")} style={{ flex: 1, padding: "15px", background: pushStatus === "granted" ? C.green : C.sky, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${C.sky}30` }}>
                {pushStatus === "granted" ? "🤙 Let's go!" : "Later instellen →"}
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}