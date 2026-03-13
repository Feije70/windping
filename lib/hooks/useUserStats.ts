import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export interface UserStats {
  user_id: number;
  total_sessions: number;
  total_spots: number;
  favorite_spot_id: number | null;
  favorite_spot_name: string | null;
  avg_rating: number | null;
  last_session_date: string | null;
  current_streak: number;
  longest_streak: number;
}

interface UseUserStatsOptions {
  token: string | null;
  userId: number | null;
}

export function useUserStats({ token, userId }: UseUserStatsOptions) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    fetch(
      `${SUPABASE_URL}/rest/v1/user_stats?user_id=eq.${userId}&select=*`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    )
      .then((r) => { if (!r.ok) throw new Error(`UserStats fetch failed: ${r.status}`); return r.json(); })
      .then((data) => setStats(data?.[0] || null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, userId, trigger]);

  return { stats, loading, error, refetch: () => setTrigger(t => t + 1) };
}
