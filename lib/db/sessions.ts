/* ── lib/db/sessions.ts ───────────────────────────────────────
   Data access functies voor de sessions tabel.
──────────────────────────────────────────────────────────── */

import type { DbSession, SessionCompleteUpdate, SessionGoingRequest } from "@/lib/types";
import { dbGet, dbPost, dbPatch, dbDelete } from "./client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/** Haal voltooide sessies op voor een gebruiker */
export async function getCompletedSessions(
  userId: number,
  token: string,
  limit = 50
): Promise<DbSession[]> {
  const rows = await dbGet<DbSession[]>(
    `sessions?created_by=eq.${userId}&status=eq.completed&order=id.desc&limit=${limit}&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,wind_feel,notes,photo_url,photo_crop,image_url`,
    token
  );
  return rows ?? [];
}

/** Haal alle actieve sessies op (going + completed) voor een gebruiker */
export async function getUserSessions(
  userId: number,
  token: string,
  limit = 10
): Promise<DbSession[]> {
  const rows = await dbGet<DbSession[]>(
    `sessions?created_by=eq.${userId}&order=id.desc&limit=${limit}&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,photo_url,notes`,
    token
  );
  return rows ?? [];
}

/** Haal sessies op met going/completed status (voor de alert pagina) */
export async function getActiveSessions(
  userId: number,
  token: string
): Promise<DbSession[]> {
  const rows = await dbGet<DbSession[]>(
    `sessions?created_by=eq.${userId}&select=id,spot_id,session_date,status,rating,photo_url`,
    token
  );
  return (rows ?? []).filter((s) => s.status !== "skipped");
}

/** Maak een nieuwe "ik ga" sessie aan */
export async function createGoingSession(
  data: SessionGoingRequest,
  token: string
): Promise<DbSession> {
  const rows = await dbPost<DbSession[]>(
    "sessions",
    data as unknown as Record<string, unknown>,
    token
  );
  return rows[0];
}

/** Werk een sessie bij (voltooien met log gegevens) */
export async function completeSession(
  sessionId: number,
  data: SessionCompleteUpdate,
  token: string
): Promise<void> {
  await dbPatch(
    `sessions?id=eq.${sessionId}`,
    data as unknown as Record<string, unknown>,
    token
  );
}

/** Verwijder een sessie */
export async function deleteSession(
  sessionId: number,
  token: string
): Promise<void> {
  await dbDelete(`sessions?id=eq.${sessionId}`, token);
}

/** Upload een sessie foto naar Supabase Storage */
export async function uploadSessionPhoto(
  file: File,
  userId: number,
  sessionId: number,
  token: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${sessionId}_${Date.now()}.${ext}`;
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/session-photos/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "x-upsert": "true",
          apikey: SUPABASE_ANON_KEY,
        },
        body: file,
      }
    );
    if (!res.ok) { console.error("Photo upload failed:", await res.text()); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/session-photos/${path}`;
  } catch (e) {
    console.error("Photo upload error:", e);
    return null;
  }
}