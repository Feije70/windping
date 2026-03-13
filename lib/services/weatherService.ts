/* ── lib/services/weatherService.ts ──────────────────────
   Open-Meteo + Stormglass integratie
   Verantwoordelijk voor: forecast data, hourly data, tide data
──────────────────────────────────────────────────────────── */

const OM_BASE = "https://api.open-meteo.com/v1/forecast";

// In-memory caches per serverless invocation
const forecastCache = new Map<string, any>();
const hourlyCache = new Map<string, any>();
const tideCache = new Map<string, any[]>();

const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

export function degToDir(deg: number): string {
  return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export function dirIndex(deg: number): number {
  return Math.round(((deg % 360 + 360) % 360) / 22.5) % 16;
}

export async function getForecast(lat: number, lng: number, days: number): Promise<any> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${days}`;
  if (forecastCache.has(key)) return forecastCache.get(key);

  const url = `${OM_BASE}?latitude=${lat}&longitude=${lng}&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=auto&forecast_days=${days}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Open-Meteo ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  forecastCache.set(key, data);
  return data;
}

export async function getHourlyForecast(lat: number, lng: number, days: number): Promise<any> {
  const key = `hourly_${lat.toFixed(3)},${lng.toFixed(3)},${days}`;
  if (hourlyCache.has(key)) return hourlyCache.get(key);

  const url = `${OM_BASE}?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo hourly ${res.status}`);
  const data = await res.json();
  hourlyCache.set(key, data);
  return data;
}

export function getHourlyForDay(
  hourlyData: any,
  dateStr: string
): { hour: number; wind: number; gust: number; dir: string }[] {
  if (!hourlyData?.hourly?.time) return [];
  const times: string[] = hourlyData.hourly.time;
  const winds: number[] = hourlyData.hourly.wind_speed_10m;
  const gusts: number[] = hourlyData.hourly.wind_gusts_10m;
  const dirs: number[] = hourlyData.hourly.wind_direction_10m;

  const hours = [6, 9, 12, 15, 18];
  const result: { hour: number; wind: number; gust: number; dir: string }[] = [];

  for (const h of hours) {
    const target = `${dateStr}T${h.toString().padStart(2, "0")}:00`;
    const idx = times.indexOf(target);
    if (idx >= 0) {
      result.push({
        hour: h,
        wind: Math.round(winds[idx] || 0),
        gust: Math.round(gusts[idx] || 0),
        dir: degToDir(dirs[idx] || 0),
      });
    }
  }
  return result;
}

export async function getTideExtremes(
  lat: number,
  lng: number,
  dateStr: string,
  stormglassKey: string
): Promise<{ time: string; type: string }[]> {
  if (!stormglassKey) return [];
  const key = `tide_${lat.toFixed(2)},${lng.toFixed(2)}`;

  let allExtremes: any[] = [];
  if (tideCache.has(key)) {
    allExtremes = tideCache.get(key)!;
  } else {
    try {
      const start = new Date(dateStr + "T00:00:00Z");
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const url = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${start.toISOString()}&end=${end.toISOString()}`;
      const res = await fetch(url, { headers: { Authorization: stormglassKey } });
      if (!res.ok) return [];
      const data = await res.json();
      allExtremes = data.data || [];
      tideCache.set(key, allExtremes);
    } catch {
      return [];
    }
  }

  return allExtremes
    .filter((e: any) => {
      const d = new Date(e.time);
      const nl = d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
      return nl === dateStr;
    })
    .map((e: any) => {
      const d = new Date(e.time);
      const timeStr = d.toLocaleTimeString("nl-NL", {
        timeZone: "Europe/Amsterdam",
        hour: "2-digit",
        minute: "2-digit",
      });
      return { time: timeStr, type: e.type === "high" ? "HW" : "LW" };
    });
}