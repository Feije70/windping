import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type { DbAlertConditions } from "@/lib/types";

export interface Alert {
  id: number;
  alert_type: string;
  target_date: string;
  spot_ids: number[];
  primary_spot_id: number | null;
  conditions: DbAlertConditions;
  delivered_email: boolean;
  delivered_push: boolean;
  is_test: boolean;
  created_at: string;
}

interface UseAlertsOptions {
  token: string | null;
  userId: number | null;
  fromDate?: string;
}

export function useAlerts({ token, userId, fromDate }: UseAlertsOptions) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    const since = fromDate || new Date().toISOString().split("T")[0];
    fetch(
      `${SUPABASE_URL}/rest/v1/alert_history?user_id=eq.${userId}&target_date=gte.${since}&is_test=eq.false&order=created_at.desc&select=id,alert_type,target_date,spot_ids,primary_spot_id,conditions,delivered_email,delivered_push,is_test,created_at`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    )
      .then((r) => { if (!r.ok) throw new Error(`Alerts fetch failed: ${r.status}`); return r.json(); })
      .then((data) => setAlerts(data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, userId, fromDate, trigger]);

  return { alerts, loading, error, refetch: () => setTrigger(t => t + 1) };
}