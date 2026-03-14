/* ── lib/utils/feedUtils.ts ───────────────────────────────
   Feed bundeling logica voor homepage alerts
──────────────────────────────────────────────────────────── */

export interface FeedSpot {
  spotId: number;
  spotName: string;
  wind: number;
  dir: string;
  gust: number;
}

export interface FeedDowngradeSpot {
  spotName: string;
  wind: number;
  dir: string;
  reasons: string[];
}

export interface BundledFeedItem {
  targetDate: string;
  dateLabel: string;
  latestCreatedAt: string;
  goSpots: FeedSpot[];
  downgradeSpots: FeedDowngradeSpot[];
  alertType: "go" | "downgrade" | "mixed";
}

export function bundleAlertsByDate(alerts: any[]): BundledFeedItem[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  type SpotState = { type: "go"; spot: FeedSpot; ts: string } | { type: "downgrade"; spot: FeedDowngradeSpot; ts: string };
  const byDate: Record<string, { spotStates: Map<string, SpotState>; latestCreatedAt: string }> = {};

  const sorted = [...alerts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (const a of sorted) {
    const date = a.target_date;
    const d = new Date(date + "T12:00:00");
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff < 0) continue;

    if (!byDate[date]) {
      byDate[date] = { spotStates: new Map(), latestCreatedAt: a.created_at };
    }
    if (new Date(a.created_at) > new Date(byDate[date].latestCreatedAt)) {
      byDate[date].latestCreatedAt = a.created_at;
    }

    const spots = a.conditions?.spots || [];
    if (a.alert_type === "go" || a.alert_type === "heads_up" || a.alert_type === "epic") {
      for (const s of spots) {
        const key = s.spotName || String(s.spotId);
        const existing = byDate[date].spotStates.get(key);
        if (!existing || existing.type !== "downgrade" || new Date(a.created_at) > new Date(existing.ts)) {
          byDate[date].spotStates.set(key, { type: "go", spot: { spotId: s.spotId, spotName: s.spotName, wind: s.wind, dir: s.dir, gust: s.gust }, ts: a.created_at });
        }
      }
    } else if (a.alert_type === "downgrade") {
      for (const s of spots) {
        const key = s.spotName || String(s.spotId);
        const reasons = a.conditions?.downgradeReasons?.[s.spotId] || [];
        byDate[date].spotStates.set(key, { type: "downgrade", spot: { spotName: s.spotName, wind: s.wind, dir: s.dir, reasons }, ts: a.created_at });
      }
    }
  }

  const items: BundledFeedItem[] = Object.entries(byDate).map(([date, data]) => {
    const d = new Date(date + "T12:00:00");
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    let dateLabel = "onbekend";
    if (diff === 0) dateLabel = "vandaag";
    else if (diff === 1) dateLabel = "morgen";
    else if (diff === 2) dateLabel = "overmorgen";
    else {
      const weekday = d.toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", "").toUpperCase();
      const dag = d.getDate();
      const maand = d.toLocaleDateString("nl-NL", { month: "short" }).replace(".", "").toUpperCase();
      dateLabel = `${weekday} ${dag} ${maand}`;
    }

    const goSpots: FeedSpot[] = [];
    const downgradeSpots: FeedDowngradeSpot[] = [];
    for (const state of data.spotStates.values()) {
      if (state.type === "go") goSpots.push(state.spot);
      else downgradeSpots.push(state.spot);
    }

    let alertType: "go" | "downgrade" | "mixed" = "go";
    if (goSpots.length > 0 && downgradeSpots.length > 0) alertType = "mixed";
    else if (downgradeSpots.length > 0) alertType = "downgrade";

    return { targetDate: date, dateLabel, latestCreatedAt: data.latestCreatedAt, goSpots, downgradeSpots, alertType };
  });

  return items
    .filter(item => {
      const d2 = new Date(item.targetDate + "T12:00:00");
      const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
      return t2 >= today;
    })
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 5);
}
