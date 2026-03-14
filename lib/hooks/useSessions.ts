/* ── lib/hooks/useSessions.ts ─────────────────────────────────
   Data hook voor sessies. Gebruikt lib/db/ voor alle queries.
──────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { getCompletedSessions } from "@/lib/db";
import type { DbSession, DbPhotoCrop } from "@/lib/types";

export interface Session {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: number | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  wind_feel: string | null;
  notes: string | null;
  photo_url: string | null;
  photo_crop: DbPhotoCrop | null;
  image_url: string | null;
}

interface UseSessionsOptions {
  token: string | null;
  userId: number | null;
}

export function useSessions({ token, userId }: UseSessionsOptions) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);

    getCompletedSessions(userId, token)
      .then((data) => setSessions(data as Session[]))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token, userId, trigger]);

  return { sessions, loading, error, refetch: () => setTrigger((t) => t + 1) };
}