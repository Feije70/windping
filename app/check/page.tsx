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

function weatherIcon(code: number, isDay: number, size = 18, color = "#6B7B8F") {
  if (code <= 1) return isDay
    ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E8A83E" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8A9BB0" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
  if (code <= 3) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>;
  if (code <= 48) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M3 11.9C3 9.2 5.2 7 7.9 7c.2 0 .4 0 .6.02A5.5 5.5 0 0 1 19 9.5c0 .17-.01.34-.03.5H20a3 3 0 0 1 0 6H7a4 4 0 0 1-4-4.1z"/><line x1="4" y1="16" x2="4" y2="18" opacity=".4"/><line x1="8" y1="16" x2="8" y2="18" opacity=".4"/><line x1="12" y1="16" x2="12" y2="18" opacity=".4"/></svg>;
  if (code <= 67) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2E8FAE" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="19" x2="8" y2="23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="16" y1="19" x2="16" y2="23"/></svg>;
  if (code <= 77) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8A9BB0" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="20" x2="10" y2="22"/><line x1="12" y1="20" x2="14" y2="22"/><line x1="16" y1="20" x2="18" y2="22"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E8A83E" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M13 11l-4 6h6l-4 6"/></svg>;
}
function weatherLabel(code: number) {
  if (code <= 1) return "Zonnig"; if (code <= 3) return "Bewolkt"; if (code <= 48) return "Mist";
  if (code <= 67) return "Regen"; if (code <= 77) return "Sneeuw"; return "Onweer";
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
            <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 2 }}>{weatherIcon(c.weather_code || 0, c.is_day || 1, 13)}</span>
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
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tooC ? C.sky : C.sub} strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>, val: temp != null ? `${temp}°` : "--", lbl: "Temp", highlight: tooC },
              { icon: weatherIcon(c.weather_code || 0, c.is_day || 1, 16, C.sub), val: weatherLabel(c.weather_code || 0), lbl: "Weer" },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E8FAE" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="19" x2="8" y2="23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="16" y1="19" x2="16" y2="23"/></svg>, val: `${rainP}%`, lbl: "Regen" },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>, val: `${gusts}`, lbl: "Windstoten" },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><path d="M12 2l2.5 5L12 8.5 9.5 7z" fill={C.sub}/></svg>, val: dir, lbl: "Richting" },
            ].map((d, i) => (
              <div key={i} style={{ padding: "8px 4px", background: C.cream, borderRadius: 10, flex: 1, margin: "0 2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 20, marginBottom: 3 }}>{d.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: d.highlight ? C.sky : C.navy }}>{d.val}</div>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 16, marginBottom: 3 }}>{weatherIcon(fCode, 1, 14)}</div>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round"><path d="M2 12c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 18c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/><path d="M2 6c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5 3.5 4.5 6 4.5"/></svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Getijden</span>
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
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{isToday ? "vandaag" : dayStr}</div>
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
  const [search, setSearch] = useState("");

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
        const isZee = s.spot_type?.toLowerCase() === "zee" || s.spot_type?.toLowerCase() === "sea" || s.spot_type?.toLowerCase() === "coast";
        if (!isZee) return undefined;
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
          const extremes = (ex?.data || []).map((p: any) => ({ time: p.time, height: p.height, type: p.type }));
          if (!extremes.length && !sl?.data?.length) return undefined;
          return {
            seaLevel: (sl?.data || []).map((p: any) => ({ time: p.time, height: p.sg ?? p.height ?? p.value })),
            extremes,
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

  const filtered = [...spots]
    .filter(d => !search || d.spot.display_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
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

        {/* Header met terugknop */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <a href="/" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: 10, background: C.card,
            boxShadow: "0 1px 3px rgba(31,53,76,0.08)", border: `1px solid ${C.cardBorder}`,
            textDecoration: "none", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </a>
          <h1 style={{ ...h, fontSize: 26, fontWeight: 800, color: C.navy, margin: 0, flex: 1 }}>Wind Check</h1>
          {updatedAt && <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{updatedAt}</span>}
        </div>

        {/* Zoekbalk — geïntegreerd als pill met icoon */}
        {status === "done" && spots.length > 2 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.card, borderRadius: 12, padding: "0 14px",
            boxShadow: "0 1px 3px rgba(31,53,76,0.06)", border: `1.5px solid ${C.cardBorder}`,
            marginBottom: 12, height: 44,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Zoek een spot…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, border: "none", background: "transparent", outline: "none",
                fontSize: 14, fontWeight: 500, color: C.navy, fontFamily: fonts.body,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: C.muted, fontSize: 16, lineHeight: 1 }}>×</button>
            )}
          </div>
        )}

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
                {mode === "status" ? "Op status" : "Mijn volgorde"}
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
              {filtered.map((d) => (
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