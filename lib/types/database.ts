/* ── lib/types/database.ts ────────────────────────────────────
   Single source of truth voor alle database row types.
   Elke interface correspondeert 1-op-1 met een Supabase tabel.
   Gebruik deze types overal waar data uit Supabase binnenkomt.
──────────────────────────────────────────────────────────── */

// ── users ────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  auth_id: string;
  email: string;
  name: string;
  created_at: string;
  min_wind_speed: number;
  max_wind_speed: number;
  min_temperature: number | null;
  temp_unit: string | null;
  language: string;
  welcome_shown: boolean;
  home_spot_id: number | null;
}

// ── spots ────────────────────────────────────────────────────

export interface DbSpot {
  id: number;
  name: string;
  display_name: string;
  region: string | null;
  spot_type: string | null;
  level: string | null;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  good_directions: string[] | null;
  min_wind: number | null;
  max_wind: number | null;
  tips: string | null;
  is_private: boolean;
  created_by: number | null;
  active: boolean;
  country: string | null;
}

// ── user_spots ───────────────────────────────────────────────

export interface DbUserSpot {
  id: number;
  user_id: number;
  spot_id: number;
}

// ── ideal_conditions ─────────────────────────────────────────

export interface DbIdealConditions {
  id: number;
  user_id: number;
  spot_id: number;
  wind_min: number;
  wind_max: number;
  directions: string[] | boolean[];
  enabled: boolean;
  perfect_wind_min: number | null;
  perfect_wind_max: number | null;
  compass_lat: number | null;
  compass_lng: number | null;
}

// ── alert_preferences ────────────────────────────────────────

export interface DbAlertPreferences {
  user_id: number;
  notify_email: boolean;
  notify_push: boolean;
  lookahead_days: number;
  epic_any_day: boolean;
  alerts_paused_until: string | null;
  available_mon: boolean;
  available_tue: boolean;
  available_wed: boolean;
  available_thu: boolean;
  available_fri: boolean;
  available_sat: boolean;
  available_sun: boolean;
  push_nieuws: boolean;
}

// ── alert_schedules ──────────────────────────────────────────

export interface DbAlertSchedule {
  user_id: number;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

// ── alert_history ────────────────────────────────────────────

export type AlertType = "go" | "heads_up" | "downgrade" | "epic" | "system_down";

export interface DbAlertConditionsSpot {
  spotId: number;
  spotName: string;
  wind: number;
  gust: number;
  dir: string;
  dirDeg: number;
  inRange: boolean;
  windOk: boolean;
  dirOk: boolean;
  userWindMin: number;
  userWindMax: number;
  changed?: boolean;
  prevWind?: number;
  prevDir?: string;
}

export interface DbAlertConditionsTide {
  time: string;
  type: "high" | "low";
  height: number;
}

export interface DbAlertConditions {
  spots: DbAlertConditionsSpot[];
  downgradeReasons?: Record<number, string[]>;
  tides?: Record<number, DbAlertConditionsTide[]>;
}

export interface DbAlertHistory {
  id: number;
  user_id: number;
  alert_type: AlertType;
  target_date: string;
  spot_ids: number[];
  conditions: DbAlertConditions;
  is_test: boolean;
  delivered_email: boolean;
  delivered_push: boolean;
  delivery_error: string | null;
  created_at: string;
}

// ── push_subscriptions ───────────────────────────────────────

export interface DbPushSubscription {
  id: number;
  user_id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

// ── sessions ─────────────────────────────────────────────────

export type SessionStatus = "going" | "completed" | "skipped";

export interface DbPhotoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: "px" | "%";
}

export interface DbSession {
  id: number;
  created_at: string;
  created_by: number;
  spot_id: number;
  session_date: string;
  alert_id: number | null;
  status: SessionStatus;
  going_at: string | null;
  rating: number | null;
  wind_feel: string | null;
  gear_type: string | null;
  gear_size: number | null;
  duration_minutes: number | null;
  notes: string | null;
  photo_url: string | null;
  photo_crop: DbPhotoCrop | null;
  image_url: string | null;
  forecast_wind: number | null;
  forecast_gust: number | null;
  forecast_dir: string | null;
  nudge_sent: boolean;
  completed_at: string | null;
}

// ── user_stats ───────────────────────────────────────────────

export interface DbUserStats {
  user_id: number;
  total_sessions: number;
  total_spots: number;
  current_streak: number;
  longest_streak: number;
  avg_rating: number | null;
  favorite_spot_id: number | null;
  favorite_gear_size: number | null;
  last_session_date: string | null;
  season_sessions: number;
  badges: string[];
  updated_at: string;
}

// ── friendships ──────────────────────────────────────────────

export type FriendshipStatus = "pending" | "accepted";

export interface DbFriendship {
  id: number;
  user_id: number;
  friend_id: number;
  status: FriendshipStatus;
  created_at: string;
}

// ── engine_runs ──────────────────────────────────────────────

export interface DbEngineRun {
  id: number;
  ran_at: string;
  alert_count: number;
}

// ── spot_enrichment ──────────────────────────────────────────

export interface DbEnrichmentCategory {
  conditions?: string;
  facilities?: string;
  hazards?: string;
  tips?: string;
  events?: string;
  news?: string;
}

export interface DbSpotEnrichment {
  spot_id: number;
  confidence: number | null;
  sources: string[] | null;
  categories: Record<string, DbEnrichmentCategory> | null;
  missing: string[] | null;
  scanned_at: string | null;
  updated_at: string | null;
  news_score: number | null;
  news_push_blocked: boolean;
  last_news_push_at: string | null;
}

// ── enrichment_jobs ──────────────────────────────────────────

export type EnrichmentJobStatus = "pending" | "running" | "done" | "error";

export interface DbEnrichmentJob {
  id: number;
  spot_id: number;
  status: EnrichmentJobStatus;
  result: DbSpotEnrichment | null;
  error_msg: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// ── spot_posts (prikbord) ────────────────────────────────────

export type PostType = "go" | "report" | "tip" | "warning" | "question";

export interface DbSpotPost {
  id: number;
  spot_id: number;
  type: PostType;
  content: string;
  author_name: string | null;
  created_at: string;
  wind_speed: number | null;
  wind_dir: string | null;
  status?: "ok" | "flagged" | "blocked";
  user_id?: number;
  isPlaceholder?: boolean;
}

// ── tide_cache ───────────────────────────────────────────────

export interface DbTideCache {
  spot_id: number;
  data_type: string;
  fetched_at: string;
  valid_until: string;
  data: unknown;
}