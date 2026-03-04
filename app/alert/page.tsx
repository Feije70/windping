"use client";

import { useEffect, useState } from "react";
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
      const hourlyMap: Record<string, HourlyData[]> = {};

      for (const alert of goAlerts) {
        const spots = alert.conditions?.spots || [];
        for (const spot of spots) {
          const key = `${spot.spotId}_${alert.target_date}`;
          if (hourlyMap[key]) continue;

          const spotRes = await fetch(
            `${SUPABASE_URL}/rest/v1/spots?id=eq.${spot.spotId}&select=latitude,longitude`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
          );
          const spotData = await spotRes.json();
          if (!spotData?.[0]?.latitude) continue;

          try {
            const omRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${spotData[0].latitude}&longitude=${spotData[0].longitude}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=7`
            );
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
        }
      }
      setHourlyData(hourlyMap);
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
        (data || []).forEach((s: any) => { map[`${s.spot_id}_${s.session_date}`] = s; });
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
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
      });
      setGoingSessions(prev => ({ ...prev, [key]: { ...session, status: "skipped" } }));
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

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 100px" }}>
        <h1 style={{ ...h, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          🔔 Wind Alerts
        </h1>
        <p style={{ fontSize: 13, color: C.sub, marginBottom: 24 }}>
          Je recente alerts en forecasts
        </p>

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌊</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Geen recente alerts</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>W. Ping houdt de forecast in de gaten voor je</div>
          </div>
        )}

        {Object.entries(alertsByDate).map(([date, dateAlerts]) => {
          const goAlerts = dateAlerts.filter(a => a.alert_type === "go" || a.alert_type === "heads_up");
          const downgradeAlerts = dateAlerts.filter(a => a.alert_type === "downgrade");
          const allSpots = goAlerts.flatMap(a => a.conditions?.spots || []);

          return (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.sky, marginBottom: 12, ...h }}>
                📅 {formatDateLabel(date)}
                {goAlerts.length > 0 && (
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 600, marginLeft: 8 }}>Go!</span>
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
                    borderRadius: 14,
                    padding: "14px 16px",
                    marginBottom: 10,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{spot.spotName}</div>
                        {daypart && (
                          <div style={{ fontSize: 12, color: C.sky, fontWeight: 600, marginTop: 2 }}>{daypart}</div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{spot.wind}kn</div>
                        <div style={{ fontSize: 11, color: C.sub }}>{spot.dir} · gusts {spot.gust}kn</div>
                      </div>
                    </div>

                    {hours.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                          <tbody>
                            <tr>
                              {hours.map(hr => (
                                <td key={hr.hour} style={{ padding: "3px 0", textAlign: "center", fontSize: 10, color: C.sub }}>{hr.hour}:00</td>
                              ))}
                            </tr>
                            <tr>
                              {hours.map(hr => (
                                <td key={hr.hour} style={{
                                  padding: "4px 0", textAlign: "center", fontSize: 14, fontWeight: 700,
                                  color: hr.wind >= wMin ? C.green : C.sub,
                                }}>
                                  {hr.wind}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              {hours.map(hr => (
                                <td key={hr.hour} style={{ padding: "2px 0", textAlign: "center", fontSize: 10, color: "#475569" }}>{hr.gust}</td>
                              ))}
                            </tr>
                            <tr>
                              {hours.map(hr => (
                                <td key={hr.hour} style={{ padding: "2px 0", textAlign: "center", fontSize: 10, color: C.sub }}>{hr.dir}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#374151", marginTop: 2 }}>
                          <span>kn / gust / dir</span>
                        </div>
                      </div>
                    )}

                    {/* ── "Ik ga!" / Session status ── */}
                    {(() => {
                      const key = `${spot.spotId}_${date}`;
                      const session = goingSessions[key];
                      const alertId = goAlerts[0]?.id;

                      if (session?.status === "completed") {
                        return (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.goBg, borderRadius: 10 }}>
                              <span style={{ fontSize: 14 }}>✅</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sessie gelogd</span>
                              {session.rating && <span style={{ fontSize: 12, marginLeft: "auto" }}>{"⭐".repeat(session.rating)}</span>}
                            </div>
                            {/* Show photo thumbnail if uploaded */}
                            {session.photo_url && (
                              <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", maxHeight: 120 }}>
                                <img src={session.photo_url} alt="Sessie foto" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }} />
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (session?.status === "going") {
                        const isPast = new Date(date + "T23:59:59") < new Date();
                        return (
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            {isPast ? (
                              <button onClick={() => { setLogSession({ ...session, spotName: spot.spotName }); setLogForm({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" }); setPhotoFile(null); setPhotoPreview(null); }}
                                style={{ flex: 1, padding: "10px", background: C.sky, border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                🏄 Log je sessie
                              </button>
                            ) : (
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.goBg, borderRadius: 10 }}>
                                <span style={{ fontSize: 14 }}>✓</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Je gaat!</span>
                              </div>
                            )}
                            <button onClick={() => handleSkip(spot.spotId, date)}
                              style={{ padding: "10px 14px", background: C.cream, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              Toch niet
                            </button>
                          </div>
                        );
                      }

                      if (session?.status === "skipped") {
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", background: C.cream, borderRadius: 10 }}>
                            <span style={{ fontSize: 12, color: C.muted }}>Overgeslagen</span>
                          </div>
                        );
                      }

                      return (
                        <div style={{ marginTop: 10 }}>
                          <button onClick={() => handleIkGa(spot.spotId, date, alertId, spot.wind, spot.gust, spot.dir)}
                            style={{ width: "100%", padding: "11px", background: C.green, border: "none", borderRadius: 10, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            Ik ga!
                          </button>
                          <div style={{ textAlign: "center", marginTop: 6, fontSize: 10, color: C.muted, lineHeight: 1.4 }}>Log je sessie achteraf en laat je crew zien dat je gaat</div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {downgradeAlerts.map((a, i) => (
                <div key={`dg-${i}`} style={{
                  background: C.terraTint,
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 16px",
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 6 }}>
                    ⬇️ Forecast verslechterd
                  </div>
                  {(a.conditions?.spots || []).map((s: any, j: number) => {
                    const reasons = a.conditions?.downgradeReasons?.[s.spotId] || [];
                    return (
                      <div key={j} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{s.spotName}</div>
                        <div style={{ fontSize: 12, color: C.amber }}>{s.wind}kn {s.dir}</div>
                        {reasons.map((r: string, k: number) => (
                          <div key={k} style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>• {r}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
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
                {([["kite", "🪁 Kite"], ["windsurf", "🏄 Windsurf"], ["wing", "🦅 Wing"], ["sup", "🛶 SUP"]] as const).map(([val, label]) => (
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