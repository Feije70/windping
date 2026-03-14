/* ── lib/hooks/useSpots.ts ────────────────────────────────────
   Data hook voor spots. Gebruikt lib/db/ voor alle queries.
──────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { getUserSpotIds, getSpotsByIds, getAllPublicSpots } from "@/lib/db";
import type { DbSpot } from "@/lib/types";

export type Spot = Pick<
  DbSpot,
  | "id"
  | "display_name"
  | "latitude"
  | "longitude"
  | "spot_type"
  | "level"
  | "min_wind"
  | "max_wind"
  | "good_directions"
  | "tips"
  | "country"
  | "region"
>;

interface UseSpotsOptions {
  token: string | null;
  onlyUserSpots?: boolean;
  userId?: number | null;
}

interface UseSpotsResult {
  spots: Spot[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSpots({
  token,
  onlyUserSpots = false,
  userId = null,
}: UseSpotsOptions): UseSpotsResult {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const fetchSpots = async () => {
      try {
        let result: Spot[];
        if (onlyUserSpots && userId) {
          const ids = await getUserSpotIds(userId, token);
          if (!ids.length) { setSpots([]); return; }
          result = await getSpotsByIds(ids, token) as Spot[];
        } else {
          result = await getAllPublicSpots(token) as Spot[];
        }
        setSpots(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchSpots();
  }, [token, onlyUserSpots, userId, trigger]);

  return { spots, loading, error, refetch: () => setTrigger((t) => t + 1) };
}