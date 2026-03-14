/* ── lib/hooks/useEnrichment.ts ───────────────────────────────
   Data hook voor spot enrichment. Gebruikt lib/db/.
──────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { getSpotEnrichment } from "@/lib/db";
import type { DbSpotEnrichment } from "@/lib/types";

export type SpotEnrichment = DbSpotEnrichment;

interface UseEnrichmentOptions {
  spotId: number | null;
  language?: string;
}

export function useEnrichment({ spotId, language = "en" }: UseEnrichmentOptions) {
  const [enrichment, setEnrichment] = useState<SpotEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spotId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    getSpotEnrichment(spotId, language)
      .then((data) => setEnrichment(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [spotId, language]);

  return { enrichment, loading, error };
}