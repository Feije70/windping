/* ── lib/hooks/useUserStats.ts ────────────────────────────────
   Data hook voor user statistieken. Gebruikt lib/db/.
──────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { getUserStats } from "@/lib/db";
import type { DbUserStats } from "@/lib/types";

export type UserStats = DbUserStats;

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

    getUserStats(userId, token)
      .then((data) => setStats(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token, userId, trigger]);

  return { stats, loading, error, refetch: () => setTrigger((t) => t + 1) };
}