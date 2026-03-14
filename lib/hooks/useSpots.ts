import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export interface Spot {
  id: number;
  display_name: string;
  latitude: number;
  longitude: number;
  spot_type: string | null;
  level: string | null;
  min_wind: number | null;
  max_wind: number | null;
  good_directions: string[] | null;
  tips: string | null;
  country: string | null;
  region: string | null;
}

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

export function useSpots({ token, onlyUserSpots = false, userId = null }: UseSpotsOptions): UseSpotsResult {
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
        let url: string;
        if (onlyUserSpots && userId) {
          const userSpotsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/user_spots?user_id=eq.${userId}&select=spot_id`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
          );
          const userSpots = await userSpotsRes.json();
          if (!userSpots?.length) { setSpots([]); return; }
          const ids = (userSpots as { spot_id: number }[]).map((s) => s.spot_id).join(",");
          url = `${SUPABASE_URL}/rest/v1/spots?id=in.(${ids})&select=id,display_name,latitude,longitude,spot_type,level,min_wind,max_wind,good_directions,tips,country,region&order=display_name`;
        } else {
          url = `${SUPABASE_URL}/rest/v1/spots?active=eq.true&is_private=eq.false&select=id,display_name,latitude,longitude,spot_type,level,min_wind,max_wind,good_directions,tips,country,region&order=display_name`;
        }
        const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Spots fetch failed: ${res.status}`);
        setSpots(await res.json() || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, [token, onlyUserSpots, userId, trigger]);

  return { spots, loading, error, refetch: () => setTrigger(t => t + 1) };
}