/* ── lib/types/api.ts ─────────────────────────────────────────
   Types voor API request/response shapes, externe API data,
   en service-laag interfaces.
──────────────────────────────────────────────────────────── */

import type { DbAlertConditionsSpot, AlertType, DbSession } from "./database";

// ── Open-Meteo ───────────────────────────────────────────────

export interface OpenMeteoDailyForecast {
  time: string[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
}

export interface OpenMeteoHourlyForecast {
  time: string[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  wind_direction_10m: number[];
}

export interface OpenMeteoDailyResponse {
  daily: OpenMeteoDailyForecast;
}

export interface OpenMeteoHourlyResponse {
  hourly: OpenMeteoHourlyForecast;
  daily: OpenMeteoDailyForecast;
}

// ── Stormglass / Tides ───────────────────────────────────────

export interface TideExtreme {
  time: string;
  type: "high" | "low";
  height: number;
}

export interface TideData {
  extremes: TideExtreme[];
  station?: string;
}

// ── Hourly wind data (verwerkt uit Open-Meteo) ───────────────

export interface HourlyWindData {
  hour: number;
  wind: number;
  gust: number;
  dir: string;
}

// ── Alert service types ──────────────────────────────────────

export interface AlertDayPayload {
  targetDate: string;
  spots: DbAlertConditionsSpot[];
  alertType: AlertType;
}

// ── Notification service inputs ──────────────────────────────

export interface BundledEmailDay {
  targetDate: string;
  spots: DbAlertConditionsSpot[];
  alertType: AlertType;
}

// ── Push notification payload ────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

// ── Session going API ────────────────────────────────────────

export interface SessionGoingRequest {
  created_by: number;
  spot_id: number;
  session_date: string;
  alert_id?: number;
  status: "going";
  going_at: string;
  forecast_wind: number;
  forecast_gust: number;
  forecast_dir: string;
}

// ── Session complete update ───────────────────────────────────

export interface SessionCompleteUpdate {
  status: "completed";
  completed_at: string;
  rating?: number;
  wind_feel?: string;
  gear_type?: string;
  gear_size?: string;
  duration_minutes?: number;
  notes?: string;
  photo_url?: string;
}

// ── Friend activity ──────────────────────────────────────────

export interface FriendActivityItem {
  id: number;
  user_id: number;
  user_name: string;
  spot_id: number;
  spot_name: string;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: number | null;
  photo_url: string | null;
  created_at: string;
}

// ── Supabase REST helper ─────────────────────────────────────

export interface SupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

// Session met extra UI-state velden (niet opgeslagen in database)
export interface SessionWithSpotName extends DbSession {
  spotName?: string;
}