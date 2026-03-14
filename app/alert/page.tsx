"use client";

import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { useUser } from "@/lib/hooks/useUser";
import { useAlertPage } from "@/lib/hooks/useAlertPage";
import type { DbAlertHistory, DbAlertConditionsSpot, HourlyWindData, TideExtreme } from "@/lib/types";
import type { LogForm } from "@/lib/hooks/useAlertPage";

const h = { fontFamily: fonts.heading };

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

export default function AlertPage() {
  const { user, token, loading: authLoading } = useUser();

  const {
    hourlyData, tideData,
    expandedPast, setExpandedPast,
    loading, goingSessions,
    logSession, setLogSession,
    logForm, setLogForm,
    saving, photoPreview, setPhotoPreview, setPhotoFile, photoUploading,
    alertsByDate, sortedFutureDates, sortedPastDates,
    handleIkGa, handleSkip, handleCompleteSession, handlePhotoSelect,
  } = useAlertPage(user, token);

  if (authLoading) return null;

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

        {!loading && Object.keys(alertsByDate).length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12 }}><path d="M2 12c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 18c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 6c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/></svg>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Geen recente alerts</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>W. Ping houdt de forecast in de gaten voor je</div>
          </div>
        )}

        {sortedFutureDates.map((date) => {
          const dateAlerts = alertsByDate[date];
          const goAlerts = dateAlerts.filter((a: DbAlertHistory) => a.alert_type === "go" || a.alert_type === "heads_up");
          const downgradeAlerts = dateAlerts.filter((a: DbAlertHistory) => a.alert_type === "downgrade");
          const allSpots = Object.values(
            goAlerts.flatMap((a: DbAlertHistory) => a.conditions?.spots || []).reduce((acc: Record<number, DbAlertConditionsSpot>, spot: DbAlertConditionsSpot) => {
              if (!acc[spot.spotId] || spot.wind > acc[spot.spotId].wind) acc[spot.spotId] = spot;
              return acc;
            }, {} as Record<number, DbAlertConditionsSpot>)
          ) as DbAlertConditionsSpot[];

          return (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy }}>{formatDateLabel(date)}</span>
                {goAlerts.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: C.green, background: C.goBg, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.5px" }}>GO</span>}
              </div>

              {allSpots.map((spot: DbAlertConditionsSpot, i: number) => {
                const hours = hourlyData[`${spot.spotId}_${date}`] || [];
                const wMin = spot.userWindMin || 12;
                const daypart = getDaypartLabel(hours, wMin);
                const key = `${spot.spotId}_${date}`;
                const session = goingSessions[key];
                const alertId = goAlerts[0]?.id;

                return (
                  <div key={`${spot.spotId}-${i}`} style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 16, overflow: "hidden", marginBottom: 10, border: `1.5px solid ${C.cardBorder}` }}>
                    <div style={{ background: "linear-gradient(135deg, #08303F 0%, #0E5470 45%, #1A7A9E 100%)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{spot.spotName}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>{spot.dir} · gusts {spot.gust}kn{daypart ? ` · ${daypart}` : ""}</div>
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
                          <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>kn · gust · richting</div>
                        </div>
                      )}

                      {session?.status === "completed" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.goBg, borderRadius: 10 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sessie gelogd</span>
                          {session.rating && <span style={{ fontSize: 11, marginLeft: "auto", color: C.gold }}>{"★".repeat(session.rating)}</span>}
                        </div>
                      )}

                      {session?.status === "going" && (() => {
                        const isPast = new Date(date + "T23:59:59") < new Date();
                        return (
                          <div style={{ display: "flex", gap: 8 }}>
                            {isPast ? (
                              <button onClick={() => { setLogSession({ ...session, spotName: spot.spotName }); setLogForm({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" }); setPhotoFile(null); setPhotoPreview(null); }}
                                style={{ flex: 1, padding: "9px", background: C.sky, border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Log je sessie</button>
                            ) : (
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: C.goBg, borderRadius: 10 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Je gaat!</span>
                              </div>
                            )}
                            <button onClick={() => handleSkip(spot.spotId, date)} style={{ padding: "9px 12px", background: C.cream, border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Toch niet</button>
                          </div>
                        );
                      })()}

                      {!session && (
                        <button onClick={() => handleIkGa(spot.spotId, date, alertId, spot.wind, spot.gust, spot.dir)}
                          style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #1A5F7A, #2E8FAE)", border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                          Ik ga!
                        </button>
                      )}

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
                              {tide.extremes.slice(0, 8).map((ex: TideExtreme, idx: number) => {
                                const t = new Date(ex.time);
                                const isHW = ex.type === "high";
                                const timeStr = t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
                                const dayStr = t.toLocaleDateString("nl-NL", { weekday: "short" });
                                const isToday = t.toDateString() === new Date().toDateString();
                                const isPast = t < new Date();
                                return (
                                  <div key={idx} style={{ flex: "0 0 auto", padding: "6px 9px", borderRadius: 9, minWidth: 56, textAlign: "center", background: isHW ? "rgba(46,143,174,0.1)" : C.card, border: `1px solid ${isHW ? "rgba(46,143,174,0.15)" : C.cardBorder}`, opacity: isPast ? 0.5 : 1 }}>
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
                    </div>
                  </div>
                );
              })}

              {downgradeAlerts.flatMap((a: DbAlertHistory, i: number) =>
                (a.conditions?.spots || []).map((s: DbAlertConditionsSpot, j: number) => {
                  const reasons = a.conditions?.downgradeReasons?.[s.spotId] || [];
                  return (
                    <div key={`dg-${i}-${j}`} style={{ background: "#FEF2F2", border: "1.5px solid rgba(220,38,38,0.12)", borderRadius: 18, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ background: "#DC2626", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>Alert ingetrokken</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.9)", lineHeight: 1 }}>{s.wind}<span style={{ fontSize: 10, fontWeight: 600 }}>kn</span></span>
                      </div>
                      <div style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{s.spotName}</div>
                          <div style={{ fontSize: 11, color: "#EF4444" }}>{s.dir}</div>
                        </div>
                        {reasons.map((r: string, k: number) => (
                          <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#EF4444", marginTop: 4, lineHeight: 1.4 }}>
                            <span style={{ marginTop: 1, flexShrink: 0 }}>•</span><span>{r}</span>
                          </div>
                        ))}
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

        {sortedPastDates.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "1px" }}>EERDER</span>
              <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
            </div>
            {sortedPastDates.map((date) => {
              const dateAlerts = alertsByDate[date];
              const goAlerts = dateAlerts.filter((a: DbAlertHistory) => a.alert_type === "go" || a.alert_type === "heads_up");
              const downgradeAlerts = dateAlerts.filter((a: DbAlertHistory) => a.alert_type === "downgrade");
              const allSpots = Object.values(
                goAlerts.flatMap((a: DbAlertHistory) => a.conditions?.spots || []).reduce((acc: Record<number, DbAlertConditionsSpot>, spot: DbAlertConditionsSpot) => {
                  if (!acc[spot.spotId] || spot.wind > acc[spot.spotId].wind) acc[spot.spotId] = spot;
                  return acc;
                }, {} as Record<number, DbAlertConditionsSpot>)
              ) as DbAlertConditionsSpot[];
              return (
                <div key={date} style={{ marginBottom: 20, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ ...h, fontSize: 15, fontWeight: 700, color: C.sub }}>{formatDateLabel(date)}</span>
                  </div>
                  {allSpots.map((spot: DbAlertConditionsSpot, i: number) => {
                    const key = `${spot.spotId}_${date}`;
                    const hours = hourlyData[key] || [];
                    const wMin = spot.userWindMin || 12;
                    const daypart = getDaypartLabel(hours, wMin);
                    const isExpanded = expandedPast[key];
                    return (
                      <div key={i} style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.cardBorder}`, marginBottom: 8, overflow: "hidden" }}>
                        <div onClick={() => setExpandedPast(prev => ({ ...prev, [key]: !prev[key] }))} style={{ background: "linear-gradient(135deg, #4A7A65, #5A9A7A)", padding: "11px 14px", cursor: "pointer" }}>
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
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                          </div>
                        </div>
                        {isExpanded && hours.length > 0 && (
                          <div style={{ padding: "12px 14px" }}>
                            <div style={{ overflowX: "auto" }}>
                              <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: 2, minWidth: 320 }}>
                                {hours.map((hr: HourlyWindData) => (
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
                            {(() => {
                              const session = Object.values(goingSessions).find(s => s.spot_id === spot.spotId && s.session_date === date);
                              if (!session) return null;
                              return (
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: C.goBg, borderRadius: 8 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
                                    {session?.status === "completed" ? "Sessie gelogd" : "Je was gegaan"}
                                    {session?.rating ? ` · ${"★".repeat(session.rating)}` : ""}
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
                  {downgradeAlerts.flatMap((a: DbAlertHistory, i: number) =>
                    (a.conditions?.spots || []).map((s: DbAlertConditionsSpot, j: number) => (
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

      {logSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setLogSession(null); setPhotoFile(null); setPhotoPreview(null); } }}>
          <div style={{ width: "100%", maxWidth: 480, background: C.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.cardBorder, margin: "0 auto 16px" }} />
            <h3 style={{ ...h, fontSize: 18, fontWeight: 800, color: C.navy, margin: "0 0 4px" }}>Sessie loggen</h3>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>{logSession.spotName} · {formatDateLabel(logSession.session_date)}</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Hoe was het?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setLogForm((f: LogForm) => ({ ...f, rating: n }))}
                    style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${logForm.rating >= n ? C.gold : C.cardBorder}`, background: logForm.rating >= n ? C.epicBg : C.cream, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {logForm.rating >= n ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>De wind was...</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([["te_weinig", "Te weinig"], ["perfect", "Perfect"], ["te_veel", "Te veel"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setLogForm((f: LogForm) => ({ ...f, wind_feel: val }))}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${logForm.wind_feel === val ? C.sky : C.cardBorder}`, background: logForm.wind_feel === val ? C.oceanTint : C.cream, color: logForm.wind_feel === val ? C.sky : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Gear</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([["kite", "Kite"], ["windsurf", "Windsurf"], ["wing", "Wing"], ["sup", "SUP"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setLogForm((f: LogForm) => ({ ...f, gear_type: val }))}
                    style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${logForm.gear_type === val ? C.sky : C.cardBorder}`, background: logForm.gear_type === val ? C.oceanTint : C.cream, color: logForm.gear_type === val ? C.sky : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {logForm.gear_type && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Maat</div>
                <input type="text" placeholder={logForm.gear_type === "kite" ? "bijv. 12m" : logForm.gear_type === "windsurf" ? "bijv. 5.3m" : "bijv. 5m"}
                  value={logForm.gear_size} onChange={e => setLogForm((f: LogForm) => ({ ...f, gear_size: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.cream, fontSize: 14, color: C.navy, outline: "none" }} />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Duur (optioneel)</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([30, 60, 90, 120, 180]).map(min => (
                  <button key={min} onClick={() => setLogForm((f: LogForm) => ({ ...f, duration_minutes: min }))}
                    style={{ flex: 1, padding: "9px 4px", borderRadius: 10, border: `2px solid ${logForm.duration_minutes === min ? C.sky : C.cardBorder}`, background: logForm.duration_minutes === min ? C.oceanTint : C.cream, color: logForm.duration_minutes === min ? C.sky : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {min < 60 ? `${min}m` : `${min / 60}u`}{min === 90 ? "½" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Foto (optioneel)</div>
              {photoPreview ? (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                  <img src={photoPreview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }} />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#FFF", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px", borderRadius: 12, border: `2px dashed ${C.cardBorder}`, background: C.cream, cursor: "pointer" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>Tik om een foto toe te voegen</span>
                  <span style={{ fontSize: 10, color: C.muted }}>JPG, PNG · Max 5MB</span>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: "none" }} />
                </label>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Notitie (optioneel)</div>
              <textarea value={logForm.notes} onChange={e => setLogForm((f: LogForm) => ({ ...f, notes: e.target.value }))}
                placeholder="Hoe was het op het water?" rows={2}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.cardBorder}`, background: C.cream, fontSize: 13, color: C.navy, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>

            <button onClick={handleCompleteSession} disabled={saving || logForm.rating === 0}
              style={{ width: "100%", padding: "14px", background: logForm.rating > 0 ? C.sky : C.muted, border: "none", borderRadius: 12, color: "#FFF", fontSize: 15, fontWeight: 700, cursor: logForm.rating > 0 ? "pointer" : "default", opacity: logForm.rating > 0 ? 1 : 0.5 }}>
              {photoUploading ? "Foto uploaden..." : saving ? "Opslaan..." : "Sessie opslaan ✓"}
            </button>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}