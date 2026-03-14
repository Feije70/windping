/* ── lib/db/users.ts ──────────────────────────────────────────
   Data access functies voor de users tabel en aanverwante
   gebruikersdata (alert_preferences, user_settings).
──────────────────────────────────────────────────────────── */

import type { DbUser, DbAlertPreferences } from "@/lib/types";
import { dbGet, dbPatch } from "./client";

/** Laad WindPing user op basis van Supabase auth_id */
export async function getUserByAuthId(
  authId: string,
  token: string
): Promise<DbUser | null> {
  const rows = await dbGet<DbUser[]>(
    `users?auth_id=eq.${encodeURIComponent(authId)}&select=id,auth_id,email,name,min_wind_speed,max_wind_speed,min_temperature,temp_unit,language,welcome_shown,home_spot_id&limit=1`,
    token
  );
  return rows?.[0] ?? null;
}

/** Werk een of meer velden bij op de users tabel */
export async function updateUser(
  userId: number,
  data: Partial<DbUser>,
  token: string
): Promise<void> {
  await dbPatch(`users?id=eq.${userId}`, data as Record<string, unknown>, token);
}

/** Laad alert voorkeuren voor een gebruiker */
export async function getAlertPreferences(
  userId: number,
  token: string
): Promise<DbAlertPreferences | null> {
  const rows = await dbGet<DbAlertPreferences[]>(
    `alert_preferences?user_id=eq.${userId}&limit=1`,
    token
  );
  return rows?.[0] ?? null;
}

/** Controleer of alerts gepauzeerd zijn — geeft datum string of null */
export async function getAlertPausedUntil(
  userId: number,
  token: string
): Promise<string | null> {
  const rows = await dbGet<{ alerts_paused_until: string | null }[]>(
    `alert_preferences?user_id=eq.${userId}&select=alerts_paused_until&limit=1`,
    token
  );
  return rows?.[0]?.alerts_paused_until ?? null;
}

/** Controleer of onboarding nodig is (geen naam, spots of prefs) */
export async function needsOnboarding(
  userId: number,
  userName: string,
  token: string
): Promise<boolean> {
  const [spots, prefs] = await Promise.all([
    dbGet<{ spot_id: number }[]>(
      `user_spots?user_id=eq.${userId}&select=spot_id&limit=1`,
      token
    ),
    dbGet<{ user_id: number }[]>(
      `alert_preferences?user_id=eq.${userId}&select=user_id&limit=1`,
      token
    ),
  ]);
  return !userName || !spots?.length || !prefs?.length;
}