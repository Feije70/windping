/* ── lib/hooks/useAlerts.ts ───────────────────────────────────
   Data hook voor alert history. Gebruikt lib/db/ voor queries.
──────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { getAlertHistory } from "@/lib/db";
import type { DbAlertHistory } from "@/lib/types";

export type Alert = DbAlertHistory;

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

    const since = fromDate ?? new Date().toISOString().split("T")[0];
    getAlertHistory(userId, since, token)
      .then((data) => setAlerts(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token, userId, fromDate, trigger]);

  return { alerts, loading, error, refetch: () => setTrigger((t) => t + 1) };
}