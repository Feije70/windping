"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { getValidToken, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };
const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToDir(deg: number) { return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function getDaypartLabel(hours: { hour: number; wind: number }[], wMin: number): string {
  if (!hours.length) return "";
  const ochtend = hours.filter(h => h.hour >= 6 && h.hour < 12).some(h => h.wind >= wMin);
  const middag = hours.filter(h => h.hour >= 12 && h.hour < 17).some(h => h.wind >= wMin);
  const avond = hours.filter(h => h.hour >= 17 && h.hour <= 21).some(h => h.wind >= wMin);
  if (ochtend && middag && avond) return "hele dag";
  if (ochtend && middag) return "ochtend + middag";
  if (middag && avond) return "middag + avond";
  if (ochtend && avond) return "ochtend + avond";
  if (ochtend) return "ochtend";
  if (middag) return "middag";
  if (avond) return "avond";
  return "";
}

interface HourlyData {
  hour: number;
  wind: number;
  gust: number;
  dir: string;
}

/* ═══════════════════════════════════════════════════════════
   PHOTO UPLOAD HELPER
   Uploads to Supabase Storage bucket "session-photos"
   Returns public URL on success
   ═══════════════════════════════════════════════════════════ */

async function uploadSessionPhoto(file: File, userId: number, sessionId: number): Promise<string | null> {
  try {
    const token = await getValidToken();
    if (!token) return null;

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${sessionId}_${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/session-photos/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });

    if (!uploadRes.ok) {
      console.error("Photo upload failed:", await uploadRes.text());
      return null;
    }

    // Return public URL
    return `${SUPABASE_URL}/storage/v1/object/public/session-photos/${path}`;
  } catch (e) {
    console.error("Photo upload error:", e);
    return null;
  }
}

export default function AlertPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<Record<string, HourlyData[]>>({});
  const [tideData, setTideData] = useState<Record<string, { extremes: any[]; station?: string }>>({});
  const [expandedPast, setExpandedPast] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [goingSessions, setGoingSessions] = useState<Record<string, any>>({});
  const [logSession, setLogSession] = useState<any>(null);
  const [logForm, setLogForm] = useState({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" });
  const [saving, setSaving] = useState(false);
  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const token = await getValidToken();
      const authId = getAuthId();
      if (!token || !authId) { setLoading(false); return; }

      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authId}&select=id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userData?.[0]) { setLoading(false); return; }
      const uid = userData[0].id;
      setUserId(uid);

      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceStr = since.toISOString().split("T")[0];

      const alertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alert_history?user_id=eq.${uid}&target_date=gte.${sinceStr}&order=target_date.desc,created_at.desc&limit=10`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      const alertData = await alertRes.json();
      setAlerts(alertData || []);

      const goAlerts = (alertData || []).filter((a: any) => a.alert_type === "go" || a.alert_type === "heads_up");
      const downgradeAlerts = (alertData || []).filter((a: any) => a.alert_type === "downgrade");
      const alertsNeedingHourly = [...goAlerts, ...downgradeAlerts];
      const hourlyMap: Record<string, HourlyData[]> = {};
      const tideMap: Record<string, { extremes: any[]; station?: string }> = {};

      for (const alert of alertsNeedingHourly) {
        const spots = alert.conditions?.spots || [];
        for (const spot of spots) {
          const key = `${spot.spotId}_${alert.target_date}`;
          if (hourlyMap[key]) continue;

          const spotRes = await fetch(
            `${SUPABASE_URL}/rest/v1/spots?id=eq.${spot.spotId}&select=latitude,longitude,spot_type`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
          );
          const spotData = await spotRes.json();
          if (!spotData?.[0]?.latitude) continue;
          const { latitude, longitude, spot_type } = spotData[0];

          const isPastDate = alert.target_date < todayStr;

          try {
            let omRes;
            if (isPastDate) {
              // Historische data via archive API
              omRes = await fetch(
                `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${alert.target_date}&end_date=${alert.target_date}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam`
              );
            } else {
              // Toekomstige data via forecast API
              omRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=7`
              );
            }
            const omData = await omRes.json();
            if (omData?.hourly?.time) {
              const hours = [7, 9, 11, 13, 15, 17, 19, 21];
              const result: HourlyData[] = [];
              for (const hr of hours) {
                const target = `${alert.target_date}T${hr.toString().padStart(2, "0")}:00`;
                const idx = omData.hourly.time.indexOf(target);
                if (idx >= 0) {
                  result.push({
                    hour: hr,
                    wind: Math.round(omData.hourly.wind_speed_10m[idx] || 0),
                    gust: Math.round(omData.hourly.wind_gusts_10m[idx] || 0),
                    dir: degToDir(omData.hourly.wind_direction_10m[idx] || 0),
                  });
                }
              }
              hourlyMap[key] = result;
            }
          } catch {}

          // Getijden voor zeespots
          if (spot_type?.toLowerCase() === "zee" && !tideMap[key]) {
            if (isPastDate) {
              // Historisch: gebruik opgeslagen getijden uit alert conditions
              const storedTides = alert.conditions?.tides?.[spot.spotId];
              if (storedTides?.length) {
                tideMap[key] = {
                  extremes: storedTides.map((t: any) => ({ time: t.time, type: t.type, height: t.height })),
                };
              }
            } else {
              // Toekomst: live API aanroepen
              try {
                const exRes = await fetch(
                  `/api/tide?spot_id=${spot.spotId}&lat=${latitude}&lng=${longitude}&type=extremes`,
                  { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                );
                if (exRes.ok) {
                  const ex = await exRes.json();
                  tideMap[key] = {
                    extremes: (ex?.data || []).map((p: any) => ({ time: p.time, height: p.height, type: p.type })),
                    station: ex?.station?.name,
                  };
                }
              } catch {}
            }
          }
        }
      }
      setHourlyData(hourlyMap);
      setTideData(tideMap);
    } catch (e) {
      console.error("Load alerts error:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) return;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${userId}&select=id,spot_id,session_date,status,rating,photo_url`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const map: Record<string, any> = {};
        // Alleen "going" sessies laden — skipped tonen we niet
        (data || []).filter((s: any) => s.status !== "skipped").forEach((s: any) => { map[`${s.spot_id}_${s.session_date}`] = s; });
        setGoingSessions(map);
      } catch {}
    })();
  }, [userId]);

  const handleIkGa = async (spotId: number, date: string, alertId: number, wind: number, gust: number, dir: string) => {
    const token = await getValidToken();
    if (!token || !userId) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ created_by: userId, spot_id: spotId, session_date: date, alert_id: alertId, status: "going", going_at: new Date().toISOString(), forecast_wind: wind, forecast_gust: gust, forecast_dir: dir }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoingSessions(prev => ({ ...prev, [`${spotId}_${date}`]: data[0] || data }));
      }
    } catch (e) { console.error("Ik ga error:", e); }
  };

  const handleSkip = async (spotId: number, date: string) => {
    const key = `${spotId}_${date}`;
    const session = goingSessions[key];
    if (!session) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      // Verwijder uit state zodat "Ik ga!" knop terugkomt
      setGoingSessions(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch {}
  };

  const handleCompleteSession = async () => {
    if (!logSession || saving) return;
    setSaving(true);
    const token = await getValidToken();
    if (!token) { setSaving(false); return; }
    try {
      // Upload photo if selected
      let photoUrl = null;
      if (photoFile && userId) {
        setPhotoUploading(true);
        photoUrl = await uploadSessionPhoto(photoFile, userId, logSession.id);
        setPhotoUploading(false);
      }

      const update: any = { status: "completed", completed_at: new Date().toISOString() };
      if (logForm.rating > 0) update.rating = logForm.rating;
      if (logForm.wind_feel) update.wind_feel = logForm.wind_feel;
      if (logForm.gear_type) update.gear_type = logForm.gear_type;
      if (logForm.gear_size) update.gear_size = logForm.gear_size;
      if (logForm.duration_minutes > 0) update.duration_minutes = logForm.duration_minutes;
      if (logForm.notes) update.notes = logForm.notes;
      if (photoUrl) update.photo_url = photoUrl;

      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${logSession.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const key = `${logSession.spot_id}_${logSession.session_date}`;
      setGoingSessions(prev => ({ ...prev, [key]: { ...prev[key], status: "completed", rating: logForm.rating, photo_url: photoUrl } }));
      setLogSession(null);
      setLogForm({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e) { console.error("Complete session error:", e); }
    setSaving(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate: max 5MB, image only
    if (file.size > 5 * 1024 * 1024) {
      alert("Foto is te groot (max 5MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Alleen afbeeldingen toegestaan");
      return;
    }
    setPhotoFile(file);
    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Group alerts by target_date
  const alertsByDate: Record<string, any[]> = {};
  for (const a of alerts) {
    if (!alertsByDate[a.target_date]) alertsByDate[a.target_date] = [];
    alertsByDate[a.target_date].push(a);
  }
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const sortedFutureDates = Object.keys(alertsByDate).filter(d => d >= todayStr).sort();
  const sortedPastDates = Object.keys(alertsByDate).filter(d => d < todayStr).sort().reverse();

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <h1 style={{ ...h, fontSize: 22, fontWeight: 800, margin: 0 }}>Wind Alerts</h1>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12 }}><path d="M2 12c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 18c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 6c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/></svg>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Geen recente alerts</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>W. Ping houdt de forecast in de gaten voor je</div>
          </div>
        )}

        {sortedFutureDates.map((date) => { const dateAlerts = alertsByDate[date];
          const goAlerts = dateAlerts.filter(a => a.alert_type === "go" || a.alert_type === "heads_up");
          const downgradeAlerts = dateAlerts.filter(a => a.alert_type === "downgrade");
          const allSpots = Object.values(
            goAlerts.flatMap((a: any) => a.conditions?.spots || []).reduce((acc: any, spot: any) => {
              if (!acc[spot.spotId] || spot.wind > acc[spot.spotId].wind) acc[spot.spotId] = spot;
              return acc;
            }, {} as Record<number, any>)
          ) as any[];

          return (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy }}>{formatDateLabel(date)}</span>
                {goAlerts.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.green, background: C.goBg, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.5px" }}>GO</span>
                )}
              </div>

              {allSpots.map((spot: any, i: number) => {
                const hours = hourlyData[`${spot.spotId}_${date}`] || [];
                const wMin = spot.userWindMin || 12;
                const daypart = getDaypartLabel(hours, wMin);

                return (
                  <div key={`${spot.spotId}-${i}`} style={{
                    background: C.card,
                    boxShadow: C.cardShadow,
                    borderRadius: 16,
                    overflow: "hidden",
                    marginBottom: 10,
                    border: `1.5px solid ${C.cardBorder}`,
                  }}>
                    {/* Compacte groene header */}
                    <div style={{ background: "linear-gradient(135deg, #1B6B4E 0%, #259068 60%, #2EAA7A 100%)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{spot.spotName}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                            {spot.dir} · gusts {spot.gust}kn{daypart ? ` · ${daypart}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-1px" }}>{spot.wind}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>kn</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "10px 14px 12px" }}>
                    {hours.length > 0 && (
                      <div style={{ overflowX: "auto", marginBottom: 8 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>{hours.map(hr => (<td key={hr.hour} style={{ padding: "2px 0", textAlign: "center", fontSize: 10, color: C.muted }}>{hr.hour}u</td>))}</tr>
                            <tr>{hours.map(hr => (<td key={hr.hour} style={{ padding: "3px 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: hr.wind >= wMin ? C.green : C.muted }}>{hr.wind}</td>))}</tr>
                            <tr>{hours.map(hr => (<td key={hr.hour} style={{ padding: "2px 0", textAlign: "center", fontSize: 10, color: C.sub }}>{hr.gust}</td>))}</tr>
                            <tr>{hours.map(hr => (<td key={hr.hour} style={{ padding: "2px 0", textAlign: "center", fontSize: 10, color: C.muted }}>{hr.dir}</td>))}</tr>
                          </tbody>
                        </table>
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 3, letterSpacing: "0.3px" }}>kn · gust · richting</div>
                      </div>
                    )}

                    {/* ── "Ik ga!" / Session status ── */}
                    {(() => {
                      const key = `${spot.spotId}_${date}`;
                      const session = goingSessions[key];
                      const alertId = goAlerts[0]?.id;

                      if (session?.status === "completed") {
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.goBg, borderRadius: 10 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sessie gelogd</span>
                            {session.rating && <span style={{ fontSize: 11, marginLeft: "auto", color: C.gold }}>{"★".repeat(session.rating)}</span>}
                          </div>
                        );
                      }

                      if (session?.status === "going") {
                        const isPast = new Date(date + "T23:59:59") < new Date();
                        return (
                          <div style={{ display: "flex", gap: 8 }}>
                            {isPast ? (
                              <button onClick={() => { setLogSession({ ...session, spotName: spot.spotName }); setLogForm({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" }); setPhotoFile(null); setPhotoPreview(null); }}
                                style={{ flex: 1, padding: "9px", background: C.sky, border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Log je sessie
                              </button>
                            ) : (
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: C.goBg, borderRadius: 10 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Je gaat!</span>
                              </div>
                            )}
                            <button onClick={() => handleSkip(spot.spotId, date)}
                              style={{ padding: "9px 12px", background: C.cream, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              Toch niet
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => handleIkGa(spot.spotId, date, alertId, spot.wind, spot.gust, spot.dir)}
                            style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg, #1B6B4E, #27A070)", border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            Ik ga!
                          </button>
                        </div>
                      );
                    })()}

                    {/* Getijden voor zeespots */}
                    {(() => {
                      const tide = tideData[`${spot.spotId}_${date}`];
                      if (!tide || tide.extremes.length === 0) return null;
                      return (
                        <div style={{ marginTop: 10, padding: "10px 12px", background: C.oceanTint, borderRadius: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round"><path d="M2 12c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 18c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 6c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/></svg>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>Getijden</span>
                            {tide.station && <span style={{ fontSize: 9, color: C.muted, marginLeft: "auto" }}>{tide.station}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 5, overflowX: "auto" }}>
                            {tide.extremes.slice(0, 8).map((ex: any, i: number) => {
                              const t = new Date(ex.time);
                              const isHW = ex.type === "high";
                              const timeStr = t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
                              const dayStr = t.toLocaleDateString("nl-NL", { weekday: "short" });
                              const isToday = t.toDateString() === new Date().toDateString();
                              const isPast = t < new Date();
                              return (
                                <div key={i} style={{ flex: "0 0 auto", padding: "6px 9px", borderRadius: 9, minWidth: 56, textAlign: "center", background: isHW ? "rgba(46,143,174,0.1)" : C.card, border: `1px solid ${isHW ? "rgba(46,143,174,0.15)" : C.cardBorder}`, opacity: isPast ? 0.5 : 1 }}>
                                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 1 }}>{isToday ? "vandaag" : dayStr}</div>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: isHW ? C.sky : C.sub }}>{timeStr}</div>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: isHW ? C.sky : C.muted, marginTop: 1 }}>{isHW ? "▲ HW" : "▼ LW"}</div>
                                  {ex.height != null && <div style={{ fontSize: 9, color: C.muted }}>{Number(ex.height).toFixed(1)}m</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>{/* end card body */}
                </div>
                );
              })}

              {downgradeAlerts.flatMap((a, i) =>
                (a.conditions?.spots || []).map((s: any, j: number) => {
                  const reasons = a.conditions?.downgradeReasons?.[s.spotId] || [];
                  return (
                    <div key={`dg-${i}-${j}`} style={{
                      background: "#FEF2F2",
                      border: "1.5px solid rgba(220,38,38,0.12)",
                      borderRadius: 18,
                      overflow: "hidden",
                      marginBottom: 10,
                    }}>
                      {/* Rode header balk */}
                      <div style={{ background: "#DC2626", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "white", letterSpacing: "0.3px" }}>Alert ingetrokken</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.9)", lineHeight: 1 }}>{s.wind}<span style={{ fontSize: 10, fontWeight: 600 }}>kn</span></span>
                      </div>
                      {/* Spot info */}
                      <div style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{s.spotName}</div>
                          <div style={{ fontSize: 11, color: "#EF4444" }}>{s.dir}</div>
                        </div>
                        {reasons.map((r: string, k: number) => (
                          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#EF4444", marginTop: 4, lineHeight: 1.4 }}>
                            <span style={{ marginTop: 1, flexShrink: 0 }}>•</span>
                            <span>{r}</span>
                          </div>
                        ))}

                        {/* Uurstabel als bevestiging */}
                        {(() => {
                          const hours = hourlyData[`${s.spotId}_${date}`] || [];
                          if (hours.length === 0) return null;
                          const wMin = 12;
                          return (
                            <div style={{ marginTop: 10, overflowX: "auto" }}>
                              <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: 2, minWidth: 320 }}>
                                {hours.map((hr: any) => (
                                  <div key={hr.hour} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 9, color: "#EF4444", opacity: 0.6, marginBottom: 3 }}>{hr.hour}u</div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: hr.wind >= wMin ? "#DC2626" : "#9CA3AF" }}>{hr.wind}</div>
                                    <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>{hr.gust}</div>
                                    <div style={{ fontSize: 8, color: "#9CA3AF" }}>{hr.dir}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 6 }}>kn · gust · richting</div>
                            </div>
                          );
                        })()}

                        <button onClick={() => handleIkGa(s.spotId, date, a.id, s.wind, s.gust || 0, s.dir)}
                          style={{ marginTop: 12, width: "100%", padding: "10px", background: "white", border: "1.5px solid #DC2626", borderRadius: 10, color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          Ik ga toch
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}

        {/* ── Verleden alerts ── */}
        {sortedPastDates.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "1px" }}>EERDER</span>
              <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
            </div>
            {sortedPastDates.map((date) => { const dateAlerts = alertsByDate[date];
              const goAlerts = dateAlerts.filter((a: any) => a.alert_type === "go" || a.alert_type === "heads_up");
              const downgradeAlerts = dateAlerts.filter((a: any) => a.alert_type === "downgrade");
              const allSpots = Object.values(
                goAlerts.flatMap((a: any) => a.conditions?.spots || []).reduce((acc: any, spot: any) => {
                  if (!acc[spot.spotId] || spot.wind > acc[spot.spotId].wind) acc[spot.spotId] = spot;
                  return acc;
                }, {} as Record<number, any>)
              ) as any[];
              return (
                <div key={date} style={{ marginBottom: 20, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ ...h, fontSize: 15, fontWeight: 700, color: C.sub }}>{formatDateLabel(date)}</span>
                  </div>
                  {allSpots.map((spot: any, i: number) => {
                    const key = `${spot.spotId}_${date}`;
                    const hours = hourlyData[key] || [];
                    const wMin = spot.userWindMin || 12;
                    const daypart = getDaypartLabel(hours, wMin);
                    const isExpanded = expandedPast[key];
                    return (
                      <div key={i} style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.cardBorder}`, marginBottom: 8, overflow: "hidden" }}>
                        {/* Klikbare header */}
                        <div onClick={() => setExpandedPast(prev => ({ ...prev, [key]: !prev[key] }))}
                          style={{ background: "linear-gradient(135deg, #4A7A65, #5A9A7A)", padding: "11px 14px", cursor: "pointer" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{spot.spotName}</div>
                              {daypart && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{spot.dir} · gusts {spot.gust}kn · {daypart}</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.9)", lineHeight: 1 }}>{spot.wind}</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>kn</span>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                <path d="M6 9l6 6 6-6"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                        {/* Uurdata uitklap */}
                        {isExpanded && hours.length > 0 && (
                          <div style={{ padding: "12px 14px" }}>
                            <div style={{ overflowX: "auto" }}>
                              <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: 2, minWidth: 320 }}>
                                {hours.map((hr: any) => (
                                  <div key={hr.hour} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{hr.hour}u</div>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: hr.wind >= wMin ? C.green : C.sub }}>{hr.wind}</div>
                                    <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{hr.gust}</div>
                                    <div style={{ fontSize: 8, color: C.muted }}>{hr.dir}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: 9, color: C.muted, marginTop: 8 }}>kn · gust · richting</div>
                            </div>

                            {/* Getijden indien beschikbaar */}
                            {(() => {
                              const tide = tideData[key];
                              if (!tide || tide.extremes.length === 0) return null;
                              const dayExtremes = tide.extremes.filter((ex: any) => {
                                const t = new Date(ex.time);
                                const localDate = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
                                return localDate === date;
                              });
                              if (dayExtremes.length === 0) return null;
                              return (
                                <div style={{ marginTop: 10, padding: "10px 12px", background: C.oceanTint, borderRadius: 10 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round"><path d="M2 12c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 18c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/></svg>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>Getijden</span>
                                    {tide.station && <span style={{ fontSize: 9, color: C.muted, marginLeft: "auto" }}>{tide.station}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                    {dayExtremes.map((ex: any, i: number) => {
                                      const t = new Date(ex.time);
                                      const isHW = ex.type === "high";
                                      const timeStr = t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
                                      return (
                                        <div key={i} style={{ padding: "5px 9px", borderRadius: 8, background: isHW ? "rgba(46,143,174,0.1)" : C.card, border: `1px solid ${isHW ? "rgba(46,143,174,0.2)" : C.cardBorder}`, textAlign: "center", minWidth: 52 }}>
                                          <div style={{ fontSize: 11, fontWeight: 800, color: isHW ? C.sky : C.sub }}>{timeStr}</div>
                                          <div style={{ fontSize: 9, fontWeight: 700, color: isHW ? C.sky : C.muted }}>{isHW ? "▲ HW" : "▼ LW"}</div>
                                          {ex.height != null && <div style={{ fontSize: 9, color: C.muted }}>{Number(ex.height).toFixed(1)}m</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Session status */}
                            {(() => {
                              const session = Object.values(goingSessions).find((s: any) => s.spot_id === spot.spotId && s.session_date === date);
                              if (!session) return null;
                              return (
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: C.goBg, borderRadius: 8 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
                                    {(session as any).status === "completed" ? "Sessie gelogd" : "Je was gegaan"}
                                    {(session as any).rating ? ` · ${"★".repeat((session as any).rating)}` : ""}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {isExpanded && hours.length === 0 && (
                          <div style={{ padding: "12px 14px", fontSize: 12, color: C.muted, fontStyle: "italic" }}>Winddata wordt geladen…</div>
                        )}
                      </div>
                    );
                  })}
                  {downgradeAlerts.flatMap((a: any, i: number) =>
                    (a.conditions?.spots || []).map((s: any, j: number) => (
                      <div key={`pdg-${i}-${j}`} style={{ background: "#FEF2F2", borderRadius: 14, border: "1.5px solid rgba(220,38,38,0.1)", marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ background: "#EF4444", padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>Alert ingetrokken</span>
                          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{s.wind}kn</span>
                        </div>
                        <div style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{s.spotName}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Session Log Modal (met foto upload) ── */}
      {logSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setLogSession(null); setPhotoFile(null); setPhotoPreview(null); } }}>
          <div style={{ width: "100%", maxWidth: 480, background: C.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.cardBorder, margin: "0 auto 16px" }} />
            
            <h3 style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 4px" }}>Sessie loggen</h3>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>{logSession.spotName} · {formatDateLabel(logSession.session_date)}</div>

            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Hoe was het?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setLogForm(f => ({ ...f, rating: n }))}
                    style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${logForm.rating >= n ? C.gold : C.cardBorder}`, background: logForm.rating >= n ? C.epicBg : C.cream, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {logForm.rating >= n ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            {/* Wind feel */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>De wind was...</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([["te_weinig", "Te weinig"], ["perfect", "Perfect"], ["te_veel", "Te veel"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setLogForm(f => ({ ...f, wind_feel: val }))}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${logForm.wind_feel === val ? C.sky : C.cardBorder}`, background: logForm.wind_feel === val ? C.oceanTint : C.cream, color: logForm.wind_feel === val ? C.sky : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gear type */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Gear</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([["kite", "Kite"], ["windsurf", "Windsurf"], ["wing", "Wing"], ["sup", "SUP"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setLogForm(f => ({ ...f, gear_type: val }))}
                    style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${logForm.gear_type === val ? C.sky : C.cardBorder}`, background: logForm.gear_type === val ? C.oceanTint : C.cream, color: logForm.gear_type === val ? C.sky : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gear size */}
            {logForm.gear_type && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Maat</div>
                <input type="text" placeholder={logForm.gear_type === "kite" ? "bijv. 12m" : logForm.gear_type === "windsurf" ? "bijv. 5.3m" : "bijv. 5m"}
                  value={logForm.gear_size} onChange={e => setLogForm(f => ({ ...f, gear_size: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.cream, fontSize: 14, color: C.navy, outline: "none" }} />
              </div>
            )}

            {/* Duration */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Duur (optioneel)</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([30, 60, 90, 120, 180]).map(min => (
                  <button key={min} onClick={() => setLogForm(f => ({ ...f, duration_minutes: min }))}
                    style={{ flex: 1, padding: "9px 4px", borderRadius: 10, border: `2px solid ${logForm.duration_minutes === min ? C.sky : C.cardBorder}`, background: logForm.duration_minutes === min ? C.oceanTint : C.cream, color: logForm.duration_minutes === min ? C.sky : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {min < 60 ? `${min}m` : `${min / 60}u`}{min === 90 ? "½" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* ── FOTO UPLOAD ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Foto (optioneel)</div>
              {photoPreview ? (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                  <img src={photoPreview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }} />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#FFF", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ✕
                  </button>
                </div>
              ) : (
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  padding: "20px", borderRadius: 12, border: `2px dashed ${C.cardBorder}`,
                  background: C.cream, cursor: "pointer", transition: "all 0.2s",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>Tik om een foto toe te voegen</span>
                  <span style={{ fontSize: 10, color: C.muted }}>JPG, PNG · Max 5MB</span>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: "none" }} />
                </label>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Notitie (optioneel)</div>
              <textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Hoe was het op het water?"
                rows={2}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.cream, fontSize: 13, color: C.navy, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>

            {/* Submit */}
            <button onClick={handleCompleteSession} disabled={saving || logForm.rating === 0}
              style={{ width: "100%", padding: "14px", background: logForm.rating > 0 ? C.green : C.muted, border: "none", borderRadius: 12, color: "#FFF", fontSize: 15, fontWeight: 700, cursor: logForm.rating > 0 ? "pointer" : "default", opacity: logForm.rating > 0 ? 1 : 0.5 }}>
              {photoUploading ? "Foto uploaden..." : saving ? "Opslaan..." : "Sessie opslaan ✓"}
            </button>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}