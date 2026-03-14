/* ── lib/db/enrichment.ts ─────────────────────────────────────
   Data access functies voor de spot_enrichment tabel.
──────────────────────────────────────────────────────────── */

import type { DbSpotEnrichment } from "@/lib/types";
import { dbGet } from "./client";

/** Haal enrichment op voor een spot in een specifieke taal.
 *  Valt terug op Engels als de gevraagde taal niet beschikbaar is. */
export async function getSpotEnrichment(
  spotId: number,
  language = "en"
): Promise<DbSpotEnrichment | null> {
  // Probeer eerst de gevraagde taal
  if (language !== "en") {
    const rows = await dbGet<DbSpotEnrichment[]>(
      `spot_enrichment?spot_id=eq.${spotId}&select=*&limit=1`
    );
    if (rows?.[0]) return rows[0];
  }

  // Fallback naar Engels
  const rows = await dbGet<DbSpotEnrichment[]>(
    `spot_enrichment?spot_id=eq.${spotId}&select=*&limit=1`
  );
  return rows?.[0] ?? null;
}