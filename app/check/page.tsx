"use client";

import { useEffect, useState, useCallback } from "react";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { getValidToken, getEmail, getAuthId, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };
const OM_BASE = "https://api.open-meteo.com/v1/forecast";

/* ── Types ── */
interface Spot { id: number; display_name: string; latitude: number; longitude: number; good_directions: string[] | null; spot_type: string | null; }
interface Conditions { spot_id: number; wind_min: number | null; wind_max: number | null; directions: string[] | null; perfect_enabled: boolean; perfect_wind_min: number | null; perfect_wind_max: number | null; perfect_directions: string[] | null; }
interface WeatherData { current: { temperature_2m: number; wind_speed_10m: number; wind_direction_10m: number; wind_gusts_10m: number; precipitation: number; weather_code: number; is_day: number; }; hourly: { time: string[]; wind_speed_10m: number[]; wind_direction_10m: number[]; precipitation_probability: number[]; weather_code: number[]; }; }
interface TidePoint { time: string; height?: number; type?: string; }
interface SpotData { spot: Spot; weather: WeatherData; match: "epic" | "go" | "maybe" | "no"; reasons: string[]; ws: number; wd: number; temp: number | null; tooC: boolean; prefs: { wMin: number; wMax: number; dirs: string[] }; tide?: { seaLevel: TidePoint[]; extremes: TidePoint[]; station?: string }; }

/* ── Helpers ── */
const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToDir(deg: number) { return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

function weatherEmoji(code: number, isDay: number) {
  if (code <= 1) return isDay ? "☀️" : "🌙";
  if (code <= 3) return isDay ? "⛅" : "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  return "⛈️";
}
function weatherLabel(code: number) {
  if (code <= 1) return "Sun"; if (code <= 3) return "Cloudy"; if (code <= 48) return "Fog";
  if (code <= 67) return "Rain"; if (code <= 77) return "Snow"; return "Thunder";
}

function calcMatch(ws: number, wd: number, prefs: { wMin: number; wMax: number; dirs: string[] }, temp: number | null, minTemp: number | null) {
  const dir = degToDir(wd);
  const sok = ws >= prefs.wMin && ws <= prefs.wMax;
  const dok = prefs.dirs.length === 0 || prefs.dirs.includes(dir);
  const near = ws >= (prefs.wMin - 3) && ws <= (prefs.wMax + 3);
  const tok = minTemp == null || temp == null || temp >= minTemp;
  const reasons: string[] = [];
  if (ws < prefs.wMin) reasons.push("Not enough wind");
  if (ws > prefs.wMax) reasons.push("Too much wind");
  if (!dok && prefs.dirs.length > 0) reasons.push("Wrong direction");
  if (!tok) reasons.push("Too cold");
  let match: "go" | "maybe" | "no";
  if (sok && dok && tok) match = "go";
  else if (((near && dok) || (sok && !dok)) && tok) match = "maybe";
  else if (sok && dok && !tok) match = "maybe";
  else match = "no";
  return { match, reasons };
}

/* ── Light theme match styles ── */
const matchColors = { epic: C.gold, go: C.green, maybe: C.gold, no: C.amber };
const matchBadgeBg = {
  epic: C.epicBg,
  go: C.goBg,
  maybe: C.epicBg,
  no: C.terraTint,
};
const matchLabel = { epic: "Epic! Go!", go: "Go!", maybe: "Almost...", no: "Not ideal" };

/* ── Supabase + Weather ── */
async function sb(path: string) {
  const token = await getValidToken();
  if (!token) throw new Error("auth");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("auth");
  if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json();
}
async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const res = await fetch(`${OM_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code,is_day&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code&forecast_days=2&wind_speed_unit=kn&timezone=Europe%2FAmsterdam`);
  if (!res.ok) throw new Error(`weather_${res.status}`);
  const data = await res.json();
  if (!data?.current || !data?.hourly) throw new Error("weather_invalid");
  return data;
}

/* ── Spot Card ── */
function SpotCard({ d, expanded, onToggle }: { d: SpotData; expanded: boolean; onToggle: () => void }) {
  const { spot, weather, match, reasons, ws, wd, temp, tooC, prefs } = d;
  const dir = degToDir(wd);
  const c = weather.current;
  const hr = weather.hourly;
  const gusts = Math.round(c.wind_gusts_10m || 0);
  const mColor = matchColors[match];

  const now = new Date();
  const today = now.toISOString().substring(0, 10);
  let nowIdx = 0;
  if (hr?.time?.length) {
    for (let i = 0; i < hr.time.length; i++) {
      if (hr.time[i].substring(0, 10) === today && parseInt(hr.time[i].substring(11, 13)) >= now.getHours()) { nowIdx = i; break; }
    }
  }
  const endIdx = Math.min(nowIdx + 12, hr.time?.length || 0);
  let rainP = 0;
  if (hr?.precipitation_probability) {
    for (let i = nowIdx; i < Math.min(nowIdx + 3, hr.precipitation_probability.length); i++) {
      if (hr.precipitation_probability[i] > rainP) rainP = hr.precipitation_probability[i];
    }
  }

  return (
    <div style={{
      background: C.card, borderRadius: 16, boxShadow: C.cardShadow,
      overflow: "hidden", transition: "all 0.25s", position: "relative",
    }}>
      {/* Main row */}
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", padding: "16px 16px", gap: 12, cursor: "pointer", position: "relative" }}>
        {/* Wind badge */}
        <div style={{
          width: 52, height: 52, borderRadius: 13, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: matchBadgeBg[match], border: `1.5px solid ${mColor}30`,
          ...(match === "epic" ? { boxShadow: `0 0 12px ${mColor}25` } : {}),
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: mColor }}>{ws}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>kn</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spot.display_name}</div>
          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>
            <span style={{ color: C.navy, fontWeight: 600 }}>{dir}</span> · gusts {gusts} kn ·{" "}
            <span style={tooC ? { color: C.sky, fontWeight: 700 } : { color: C.sub }}>{temp != null ? `${temp}°` : "--"}</span>{" "}
            {weatherEmoji(c.weather_code || 0, c.is_day || 1)}
          </div>
        </div>

        {/* Match label */}
        <div style={{
          textAlign: "center", padding: "5px 10px", borderRadius: 8,
          background: matchBadgeBg[match], flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: mColor }}>{matchLabel[match]}</div>
          {reasons.length > 0 && match !== "go" && match !== "epic" && (
            <div style={{ fontSize: 9, fontWeight: 500, marginTop: 1, opacity: 0.8, lineHeight: 1.2, color: C.sub }}>{reasons.join(" · ")}</div>
          )}
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: "14px 16px 18px", borderTop: `1px solid ${C.cardBorder}`, position: "relative" }}>
          {/* Detail stats */}
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginBottom: 16 }}>
            {[
              { icon: "🌡️", val: temp != null ? `${temp}°` : "--", lbl: "Temp", highlight: tooC },
              { icon: weatherEmoji(c.weather_code || 0, c.is_day || 1), val: weatherLabel(c.weather_code || 0), lbl: "Weather" },
              { icon: "🌧️", val: `${rainP}%`, lbl: "Rain" },
              { icon: "💨", val: `${gusts}`, lbl: "Gusts" },
              { icon: "🧭", val: dir, lbl: "Direction" },
            ].map((d, i) => (
              <div key={i} style={{
                padding: "8px 4px", background: C.cream, borderRadius: 10, flex: 1, margin: "0 2px",
              }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{d.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: d.highlight ? C.sky : C.navy }}>{d.val}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{d.lbl}</div>
              </div>
            ))}
          </div>

          {/* Hourly forecast */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 4 }}>
            {Array.from({ length: endIdx - nowIdx }, (_, i) => {
              const idx = nowIdx + i;
              const fW = Math.round(hr.wind_speed_10m?.[idx] || 0);
              const fWD = hr.wind_direction_10m?.[idx] || 0;
              const fCode = hr.weather_code?.[idx] || 0;
              const fR = calcMatch(fW, fWD, prefs, null, null);
              const fColor = matchColors[fR.match];
              return (
                <div key={idx} style={{ flex: "0 0 auto", textAlign: "center", padding: "6px 5px", minWidth: 40 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{hr.time[idx]?.substring(11, 16) || "--"}</div>
                  <div style={{ fontSize: 12, marginBottom: 3 }}>{weatherEmoji(fCode, 1)}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 800, color: fColor, background: `${fColor}15`,
                    borderRadius: 6, padding: "2px 5px", marginBottom: 3,
                  }}>{fW}</div>
                  <div style={{ fontSize: 9, color: C.sub }}>{degToDir(fWD)}</div>
                </div>
              );
            })}
          </div>

          {/* Tide section */}
          {d.tide && d.tide.extremes.length > 0 && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.oceanTint, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>🌊</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Tides</span>
                {d.tide.station && <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>{d.tide.station}</span>}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {d.tide.extremes.slice(0, 8).map((ex, i) => {
                  const t = new Date(ex.time);
                  const isHW = ex.type === "high";
                  const timeStr = t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
                  const dayStr = t.toLocaleDateString("nl-NL", { weekday: "short" });
                  const isToday = t.toDateString() === new Date().toDateString();
                  const isPast = t < new Date();
                  return (
                    <div key={i} style={{
                      flex: "0 0 auto", padding: "7px 10px", borderRadius: 10, minWidth: 60, textAlign: "center",
                      background: isHW ? "rgba(46,111,126,0.08)" : C.card,
                      border: `1px solid ${isHW ? "rgba(46,111,126,0.12)" : C.cardBorder}`,
                      opacity: isPast ? 0.5 : 1,
                    }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{isToday ? "today" : dayStr}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isHW ? C.sky : C.sub }}>{timeStr}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isHW ? C.sky : C.muted, marginTop: 1 }}>
                        {isHW ? "▲ HW" : "▼ LW"}
                      </div>
                      {ex.height != null && (
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{(ex.height as number).toFixed(1)}m</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function CheckPage() {
  const [status, setStatus] = useState<"loading" | "login" | "empty" | "error" | "done">("loading");
  const [spots, setSpots] = useState<SpotData[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [sortMode, setSortMode] = useState<"status" | "mine">("status");

  const loadWeather = useCallback(async () => {
    const email = getEmail();
    if (!email || isTokenExpired()) { setStatus("login"); return; }
    setStatus("loading"); setError("");

    try {
      const authId = getAuthId();
      const users = await sb(`users?auth_id=eq.${encodeURIComponent(authId || "")}&select=id,min_temperature`);
      if (!users?.length) throw new Error("no_user");
      const uid = users[0].id;
      const userMinTemp = users[0].min_temperature ?? null;

      const userSpots = await sb(`user_spots?user_id=eq.${uid}&select=spot_id`);
      if (!userSpots?.length) { setStatus("empty"); return; }
      const ids = userSpots.map((x: any) => x.spot_id);

      const [spotsData, condsData] = await Promise.all([
        sb(`spots?id=in.(${ids.join(",")})&select=id,display_name,latitude,longitude,good_directions,spot_type`),
        sb(`ideal_conditions?user_id=eq.${uid}&spot_id=in.(${ids.join(",")})&select=spot_id,wind_min,wind_max,directions,perfect_enabled,perfect_wind_min,perfect_wind_max,perfect_directions`),
      ]);

      const conds: Record<number, Conditions> = {};
      (condsData || []).forEach((ic: Conditions) => { conds[ic.spot_id] = ic; });
      const validSpots = (spotsData || []).filter((s: Spot) => s.latitude != null && s.longitude != null);
      if (!validSpots.length) { setStatus("empty"); return; }

      const weathers = await Promise.all(validSpots.map((s: Spot) => fetchWeather(s.latitude, s.longitude).catch(() => null)));

      const tideToken = await getValidToken();
      async function fetchTide(s: Spot): Promise<SpotData["tide"] | undefined> {
        if (s.spot_type?.toLowerCase() !== "zee") return undefined;
        try {
          const [slRes, exRes] = await Promise.all([
            fetch(`/api/tide?spot_id=${s.id}&lat=${s.latitude}&lng=${s.longitude}&type=sea_level`, {
              headers: tideToken ? { Authorization: `Bearer ${tideToken}` } : {},
            }),
            fetch(`/api/tide?spot_id=${s.id}&lat=${s.latitude}&lng=${s.longitude}&type=extremes`, {
              headers: tideToken ? { Authorization: `Bearer ${tideToken}` } : {},
            }),
          ]);
          const sl = slRes.ok ? await slRes.json() : null;
          const ex = exRes.ok ? await exRes.json() : null;
          return {
            seaLevel: (sl?.data || []).map((p: any) => ({ time: p.time, height: p.sg ?? p.height ?? p.value })),
            extremes: (ex?.data || []).map((p: any) => ({ time: p.time, height: p.height, type: p.type })),
            station: sl?.station?.name || ex?.station?.name,
          };
        } catch { return undefined; }
      }
      const tides = await Promise.all(validSpots.map((s: Spot) => fetchTide(s)));

      const results: SpotData[] = [];
      for (let i = 0; i < validSpots.length; i++) {
        const w = weathers[i]; if (!w) continue;
        const s = validSpots[i];
        const ic = conds[s.id];
        const prefs = { wMin: ic?.wind_min ?? 15, wMax: ic?.wind_max ?? 25, dirs: ic?.directions?.length ? ic.directions : (s.good_directions || []) };
        const ws = Math.round(w.current.wind_speed_10m || 0);
        const wd = w.current.wind_direction_10m || 0;
        const temp = w.current.temperature_2m != null ? Math.round(w.current.temperature_2m) : null;
        const result = calcMatch(ws, wd, prefs, temp, userMinTemp);

        let isEpic = false;
        if (ic?.perfect_enabled && result.match === "go") {
          const eDir = degToDir(wd);
          const eDirs = ic.perfect_directions || [];
          const eDok = eDirs.length === 0 || eDirs.includes(eDir);
          const eSok = ic.perfect_wind_min != null && ic.perfect_wind_max != null && ws >= ic.perfect_wind_min && ws <= ic.perfect_wind_max;
          const eTok = userMinTemp == null || (temp != null && temp >= userMinTemp);
          if (eSok && eDok && eTok) isEpic = true;
        }
        results.push({ spot: s, weather: w, prefs, match: isEpic ? "epic" : result.match, reasons: result.reasons, ws, wd, temp, tooC: userMinTemp != null && temp != null && temp < userMinTemp, tide: tides[i] });
      }

      setSpots(results);
      setExpanded(new Set(results.map(r => r.spot.id)));
      setUpdatedAt(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
      setStatus("done");
    } catch (e: any) {
      if (e.message === "auth") { setStatus("login"); return; }
      setError(e.message || "Something went wrong");
      setStatus("error");
    }
  }, []);

  useEffect(() => { loadWeather(); }, [loadWeather]);

  const sorted = [...spots].sort((a, b) => {
    if (sortMode === "status") {
      const order = { epic: 0, go: 1, maybe: 2, no: 3 };
      return order[a.match] - order[b.match];
    }
    return 0;
  });

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 100px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 style={{ ...h, fontSize: 26, fontWeight: 800, color: C.navy, margin: 0 }}>Wind Check</h1>
          {updatedAt && <span style={{ fontSize: 12, color: C.muted }}>Updated {updatedAt}</span>}
        </div>

        {/* Sort bar */}
        {status === "done" && spots.length > 1 && (
          <div style={{ display: "flex", background: C.creamDark, borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
            {(["status", "mine"] as const).map((mode) => (
              <button key={mode} onClick={() => setSortMode(mode)} style={{
                flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: sortMode === mode ? C.card : "transparent",
                color: sortMode === mode ? C.navy : C.muted,
                boxShadow: sortMode === mode ? "0 1px 3px rgba(31,53,76,0.06)" : "none",
                transition: "all 0.15s",
              }}>
                {mode === "status" ? "By status" : "My order"}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>Loading your data...</div>
          </div>
        )}

        {/* Not logged in */}
        {status === "login" && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16, boxShadow: C.cardShadow }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Niet ingelogd</div>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Log in om je condities te checken.</div>
            <a href="/login" style={{ display: "inline-block", padding: "10px 24px", background: C.sky, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 10, textDecoration: "none" }}>
              Log in →
            </a>
          </div>
        )}

        {/* Empty */}
        {status === "empty" && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16, boxShadow: C.cardShadow, border: `1.5px dashed ${C.cardBorder}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen spots</div>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Voeg spots toe om condities te checken.</div>
            <a href="/spots" style={{ display: "inline-block", padding: "10px 24px", background: C.sky, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 10, textDecoration: "none" }}>
              Ontdek spots →
            </a>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16, boxShadow: C.cardShadow }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.amber, marginBottom: 8 }}>{error}</div>
            <button onClick={loadWeather} style={{ padding: "8px 20px", background: C.sky, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>
              Probeer opnieuw
            </button>
          </div>
        )}

        {/* Spots */}
        {status === "done" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sorted.map((d) => (
                <SpotCard key={d.spot.id} d={d} expanded={expanded.has(d.spot.id)}
                  onToggle={() => setExpanded(prev => { const next = new Set(prev); if (next.has(d.spot.id)) next.delete(d.spot.id); else next.add(d.spot.id); return next; })}
                />
              ))}
            </div>
            <button onClick={loadWeather} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: "100%", marginTop: 14, padding: "12px 20px",
              background: C.card, boxShadow: "0 1px 3px rgba(31,53,76,0.04)", borderRadius: 12,
              fontSize: 13, fontWeight: 600, color: C.sky, cursor: "pointer", border: "none",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}