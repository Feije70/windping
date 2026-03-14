/* ── lib/db/index.ts ──────────────────────────────────────────
   Centrale re-export van alle data access functies.
   Gebruik in hooks en components:
     import { getUserByAuthId, getSpotsByIds } from "@/lib/db";
──────────────────────────────────────────────────────────── */

export { dbGet, dbPatch, dbPost, dbDelete } from "./client";

export {
  getUserByAuthId,
  updateUser,
  getAlertPreferences,
  getAlertPausedUntil,
  needsOnboarding,
} from "./users";

export {
  getUserSpotIds,
  getSpotsByIds,
  getSpotById,
  getAllPublicSpots,
  getIdealConditions,
  getSpotPosts,
  getSpotNames,
} from "./spots";

export {
  getCompletedSessions,
  getUserSessions,
  getActiveSessions,
  createGoingSession,
  completeSession,
  deleteSession,
  uploadSessionPhoto,
} from "./sessions";

export {
  getAlertHistory,
  getRecentAlertHistory,
} from "./alerts";

export { getUserStats } from "./stats";

export { getSpotEnrichment } from "./enrichment";