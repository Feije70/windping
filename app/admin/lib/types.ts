export interface AlertHistoryItem {
  id: number;
  alert_type: string;
  target_date: string;
  spot_ids: number[];
  conditions: Record<string, unknown> | null;
  is_test: boolean;
  created_at: string;
  delivered_push: boolean;
  delivered_email: boolean;
}

export interface UserInfo { id: number; email: string; name: string; }
export interface SpotInfo { id: number; name?: string; display_name?: string; }

export interface HealthData {
  timestamp: string;
  heartbeat: {
    lastRun: string | null;
    hoursSinceLastRun: number | null;
    recentRuns: { timestamp: string; alertCount: number; types: string[] }[];
    status: "healthy" | "warning" | "critical" | "unknown";
  };
  funnel: {
    total: number;
    emailSent: number;
    emailFailed: number;
    pushSent: number;
    pushFailed: number;
    byType: Record<string, number>;
    errors: { id: number; error: string | null; type: string; date: string }[];
  };
  users: {
    id: number;
    name: string;
    email: string;
    notifyEmail: boolean;
    notifyPush: boolean;
    isPaused: boolean;
    availableDays: number;
    lastAlertAt: string | null;
    lastAlertType: string | null;
    daysSinceAlert: number | null;
    totalAlerts7d: number;
    emailDelivered7d: number;
    pushDelivered7d: number;
  }[];
  redFlags: { severity: "critical" | "warning" | "info"; message: string; detail?: string }[];
}