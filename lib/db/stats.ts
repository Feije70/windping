/* ── lib/db/stats.ts ──────────────────────────────────────────
   Data access functies voor de user_stats tabel.
──────────────────────────────────────────────────────────── */

import type { DbUserStats } from "@/lib/types";
import { dbGet } from "./client";

/** Haal statistieken op voor een gebruiker */
export async function getUserStats(
  userId: number,
  token: string
): Promise<DbUserStats | null> {
  const rows = await dbGet<DbUserStats[]>(
    `user_stats?user_id=eq.${userId}&select=*`,
    token
  );
  return rows?.[0] ?? null;
}