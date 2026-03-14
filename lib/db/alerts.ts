/* ── lib/db/alerts.ts ─────────────────────────────────────────
   Data access functies voor de alert_history tabel.
──────────────────────────────────────────────────────────── */

import type { DbAlertHistory } from "@/lib/types";
import { dbGet } from "./client";

/** Haal alert history op voor een gebruiker vanaf een datum */
export async function getAlertHistory(
  userId: number,
  fromDate: string,
  token: string,
  limit = 20
): Promise<DbAlertHistory[]> {
  const rows = await dbGet<DbAlertHistory[]>(
    `alert_history?user_id=eq.${userId}&target_date=gte.${fromDate}&is_test=eq.false&order=created_at.desc&limit=${limit}&select=id,alert_type,target_date,spot_ids,conditions,delivered_email,delivered_push,is_test,created_at`,
    token
  );
  return rows ?? [];
}

/** Haal recente alert history op (afgelopen N dagen) */
export async function getRecentAlertHistory(
  userId: number,
  days: number,
  token: string
): Promise<DbAlertHistory[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];
  return getAlertHistory(userId, sinceStr, token);
}