import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export interface SpotEnrichment {
  id: number;
  spot_id: number;
  language: string;
  description: string | null;
  best_months: string[] | null;
  hazards: string | null;
  local_tips: string | null;
  nearby_amenities: string | null;
  news_summary: string | null;
  news_changed: boolean;
  enriched_at: string | null;
}

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
    fetch(
      `${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spotId}&language=eq.${language}&select=*&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY } }
    )
      .then((r) => { if (!r.ok) throw new Error(`Enrichment fetch failed: ${r.status}`); return r.json(); })
      .then(async (data) => {
        if (data?.[0]) { setEnrichment(data[0]); return; }
        if (language !== "en") {
          const fb = await fetch(
            `${SUPABASE_URL}/rest/v1/spot_enrichment?spot_id=eq.${spotId}&language=eq.en&select=*&limit=1`,
            { headers: { apikey: SUPABASE_ANON_KEY } }
          ).then((r) => r.json());
          setEnrichment(fb?.[0] || null);
        } else {
          setEnrichment(null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [spotId, language]);

  return { enrichment, loading, error };
}
