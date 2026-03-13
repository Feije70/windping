/* ── lib/services/alertService.ts ────────────────────────
   Alert evaluatie logica
   Verantwoordelijk voor: spot evaluatie, downgrade redenen, datum labels
──────────────────────────────────────────────────────────── */

import { degToDir, dirIndex } from "./weatherService";

export const DAY_DB = [
  "available_sun", "available_mon", "available_tue", "available_wed",
  "available_thu", "available_fri", "available_sat",
] as const;

export type DayKey = typeof DAY_DB[number];

export interface SpotCondition {
  spotId: number;
  spotName: string;
  wind: number;
  gust: number;
  dir: string;
  dirDeg: number;
}

export interface SpotMatch extends SpotCondition {
  inRange: boolean;
  windOk: boolean;
  dirOk: boolean;
  userWindMin: number;
  userWindMax: number;
  changed?: boolean;
  prevWind?: number;
  prevDir?: string;
}

export interface AlertToSend {
  type: "heads_up" | "go" | "downgrade";
  targetDate: string;
  spots: SpotMatch[];
  previousConditions?: Record<number, SpotCondition>;
  downgradeReasons?: Record<number, string[]>;
}

export function evaluateSpot(forecast: any, dayIndex: number, spot: any, ic: any): SpotMatch {
  const wind = Math.round(forecast.daily.wind_speed_10m_max[dayIndex] || 0);
  const gust = Math.round(forecast.daily.wind_gusts_10m_max[dayIndex] || 0);
  const dirDeg = forecast.daily.wind_direction_10m_dominant[dayIndex] || 0;
  const dir = degToDir(dirDeg);

  const wMin = ic?.wind_min ?? 12;
  const wMax = ic?.wind_max ?? 35;

  const rawDirs = ic?.directions?.length ? ic.directions : (spot.good_directions || []);
  let dirOk = true;
  if (rawDirs.length > 0) {
    if (typeof rawDirs[0] === "string") {
      dirOk = rawDirs.includes(dir);
    } else {
      const dIdx = dirIndex(dirDeg);
      dirOk = rawDirs[dIdx] === true;
    }
  }

  const windOk = wind >= wMin && wind <= wMax;

  return {
    spotId: spot.id,
    spotName: spot.display_name,
    wind, gust, dir, dirDeg,
    inRange: windOk && dirOk,
    windOk, dirOk,
    userWindMin: wMin,
    userWindMax: wMax,
  };
}

export function buildDowngradeReasons(current: SpotMatch, previous: SpotCondition): string[] {
  const reasons: string[] = [];
  if (!current.windOk) {
    if (current.wind < current.userWindMin) {
      reasons.push(`Wind: ${previous.wind}kn → ${current.wind}kn (minimum: ${current.userWindMin}kn)`);
    } else if (current.wind > current.userWindMax) {
      reasons.push(`Wind: ${previous.wind}kn → ${current.wind}kn (maximum: ${current.userWindMax}kn)`);
    }
  }
  if (!current.dirOk) {
    reasons.push(`Richting: ${previous.dir} → ${current.dir} (niet in je instellingen)`);
  }
  return reasons;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}