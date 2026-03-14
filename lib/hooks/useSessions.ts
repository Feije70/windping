import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type { DbPhotoCrop } from "@/lib/types";

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
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${userId}&status=eq.completed&order=id.desc&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,wind_feel,notes,photo_url,photo_crop,image_url`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    )
      .then((r) => { if (!r.ok) throw new Error(`Sessions fetch failed: ${r.status}`); return r.json(); })
      .then((data) => setSessions(data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, userId, trigger]);

  return { sessions, loading, error, refetch: () => setTrigger(t => t + 1) };
}