/* ── lib/db/spots.ts ──────────────────────────────────────────
   Data access functies voor spots, user_spots en
   ideal_conditions tabellen.
──────────────────────────────────────────────────────────── */

import type { DbSpot, DbUserSpot, DbIdealConditions, DbSpotPost } from "@/lib/types";
import { dbGet } from "./client";

/** Haal spot IDs op die gekoppeld zijn aan een gebruiker */
export async function getUserSpotIds(
  userId: number,
  token: string
): Promise<number[]> {
  const rows = await dbGet<DbUserSpot[]>(
    `user_spots?user_id=eq.${userId}&select=spot_id`,
    token
  );
  return (rows ?? []).map((r) => r.spot_id);
}

/** Haal spots op op basis van een lijst van IDs */
export async function getSpotsByIds(
  ids: number[],
  token: string
): Promise<DbSpot[]> {
  if (!ids.length) return [];
  const rows = await dbGet<DbSpot[]>(
    `spots?id=in.(${ids.join(",")})&select=id,display_name,latitude,longitude,lat,lng,spot_type,level,min_wind,max_wind,good_directions,tips,country,region,is_private,active,created_by`,
    token
  );
  return rows ?? [];
}

/** Haal één spot op op basis van ID */
export async function getSpotById(
  spotId: number,
  token: string
): Promise<DbSpot | null> {
  const rows = await dbGet<DbSpot[]>(
    `spots?id=eq.${spotId}&select=id,display_name,latitude,longitude,lat,lng,spot_type,level,min_wind,max_wind,good_directions,tips,country,region,is_private,active,created_by&limit=1`,
    token
  );
  return rows?.[0] ?? null;
}

/** Haal alle publieke actieve spots op */
export async function getAllPublicSpots(
  token: string
): Promise<Pick<DbSpot, "id" | "display_name" | "latitude" | "longitude">[]> {
  const rows = await dbGet<Pick<DbSpot, "id" | "display_name" | "latitude" | "longitude">[]>(
    `spots?active=eq.true&is_private=eq.false&select=id,display_name,latitude,longitude&order=display_name`,
    token
  );
  return rows ?? [];
}

/** Haal ideal conditions op voor een gebruiker en lijst van spot IDs */
export async function getIdealConditions(
  userId: number,
  spotIds: number[],
  token: string
): Promise<DbIdealConditions[]> {
  if (!spotIds.length) return [];
  const rows = await dbGet<DbIdealConditions[]>(
    `ideal_conditions?user_id=eq.${userId}&spot_id=in.(${spotIds.join(",")})&select=spot_id,wind_min,wind_max,directions,enabled,perfect_wind_min,perfect_wind_max`,
    token
  );
  return rows ?? [];
}

/** Haal recente prikbord posts op voor een spot */
export async function getSpotPosts(
  spotId: number,
  limit = 3
): Promise<DbSpotPost[]> {
  const rows = await dbGet<DbSpotPost[]>(
    `spot_posts?spot_id=eq.${spotId}&order=created_at.desc&limit=${limit}&select=id,type,content,author_name,created_at,wind_speed,wind_dir`
  );
  return rows ?? [];
}

/** Haal display_name op voor een lijst spot IDs (voor sessies buiten user_spots) */
export async function getSpotNames(
  spotIds: number[],
  token: string
): Promise<Record<number, string>> {
  if (!spotIds.length) return {};
  const rows = await dbGet<Pick<DbSpot, "id" | "display_name">[]>(
    `spots?id=in.(${spotIds.join(",")})&select=id,display_name`,
    token
  );
  const map: Record<number, string> = {};
  (rows ?? []).forEach((s) => { map[s.id] = s.display_name; });
  return map;
}