/* ── lib/types/index.ts ───────────────────────────────────────
   Centrale re-export van alle WindPing types.
   Gebruik in de rest van de app:
     import type { DbSession, DbSpot, HourlyWindData } from "@/lib/types";
──────────────────────────────────────────────────────────── */

export type {
  SessionWithSpotName,
} from "./api";

export type { WindPingUser } from "../hooks/useUser";

export type {
  // Database row types
  DbUser,
  DbSpot,
  DbUserSpot,
  DbIdealConditions,
  DbAlertPreferences,
  DbAlertSchedule,
  DbAlertHistory,
  DbAlertConditions,
  DbAlertConditionsSpot,
  DbAlertConditionsTide,
  DbPushSubscription,
  DbSession,
  DbPhotoCrop,
  DbUserStats,
  DbFriendship,
  DbEngineRun,
  DbSpotEnrichment,
  DbEnrichmentCategory,
  DbEnrichmentJob,
  DbSpotPost,
  DbTideCache,
  // Union types / enums
  AlertType,
  SessionStatus,
  FriendshipStatus,
  EnrichmentJobStatus,
  PostType,
} from "./database";

export type {
  // Open-Meteo
  OpenMeteoDailyForecast,
  OpenMeteoHourlyForecast,
  OpenMeteoDailyResponse,
  OpenMeteoHourlyResponse,
  // Tides
  TideExtreme,
  TideData,
  // Verwerkte wind data
  HourlyWindData,
  // Service types
  AlertDayPayload,
  BundledEmailDay,
  PushPayload,
  SessionGoingRequest,
  SessionCompleteUpdate,
  FriendActivityItem,
  SupabaseError,
} from "./api";