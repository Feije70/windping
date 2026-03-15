"use client";
import { useEffect, useState } from "react";
import { C } from "../lib/constants";
import { fonts } from "@/lib/design";

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: C.creamDark, borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

function SparkBar({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {entries.map(([date, count]) => {
        const h = max > 0 ? Math.max(4, Math.round((count / max) * 40)) : 4;
        const isToday = date === new Date().toISOString().split("T")[0];
        return (
          <div key={date} title={`${date}: ${count} sessies`} style={{
            flex: 1, height: h, borderRadius: 2,
            background: isToday ? C.sky : count > 0 ? `${C.sky}60` : C.creamDark,
            transition: "height 0.4s ease",
          }} />
        );
      })}
    </div>
  );
}

interface TopSpot {
  id: number;
  name: string;
  count: number;
  avgRating: number | null;
}

interface TopUser {
  id: number;
  name: string;
  count: number;
}

interface StatsOverview {
  totalUsers: number;
  activeUsers30d: number;
  totalSessions: number;
  completedSessions: number;
  goingSessions: number;
  totalSpots: number;
  totalReactions: number;
  totalFriendships: number;
  sessionsLast7d: number;
  avgRating: number | null;
}

interface StatsData {
  overview: StatsOverview;
  topSpots: TopSpot[];
  reactionCounts: Record<string, number>;
  sessionsByDay: Record<string, number>;
  ratingDist: Record<string, number>;
  topUsers: TopUser[];
  usersByMonth: Record<string, number>;
}

function StatsTab({ token }: { token: string | null }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setStats(await res.json());
      } catch {}
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
    </div>
  );

  if (!stats) return <div style={{ color: C.amber, fontSize: 13 }}>Stats konden niet worden geladen.</div>;

  const { overview, topSpots, reactionCounts, sessionsByDay, ratingDist, topUsers } = stats;
  const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker", 5: "Epic" };
  const ratingColors: Record<number, string> = { 1: C.terra, 2: C.terra, 3: C.gold, 4: C.sky, 5: C.green };
  const maxRating = Math.max(...Object.values(ratingDist as Record<string, number>), 1);
  const maxSpot = topSpots?.[0]?.count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Overview grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Gebruikers", value: overview.totalUsers, sub: `${overview.activeUsers30d} actief (30d)`, color: C.sky },
          { label: "Sessies", value: overview.completedSessions, sub: `${overview.sessionsLast7d} deze week`, color: C.green },
          { label: "Reacties", value: overview.totalReactions, sub: "🤙 stoked", color: C.gold },
          { label: "Vriendschappen", value: overview.totalFriendships, sub: `${overview.totalSpots} spots totaal`, color: C.purple },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: item.color, fontFamily: fonts.heading, letterSpacing: 1 }}>{item.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 2 }}>{item.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Gem. rating */}
      {overview.avgRating && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, fontFamily: fonts.heading }}>{overview.avgRating}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Gemiddelde sessierating</div>
            <div style={{ fontSize: 10, color: C.muted }}>Over {overview.completedSessions} completed sessies</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 24 }}>⭐</div>
        </div>
      )}

      {/* Sessions last 14 days sparkbar */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: "0.06em" }}>SESSIES — LAATSTE 14 DAGEN</div>
        <SparkBar data={sessionsByDay} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: C.muted }}>14 dagen geleden</span>
          <span style={{ fontSize: 9, color: C.sky, fontWeight: 700 }}>Vandaag</span>
        </div>
      </div>

      {/* Top spots */}
      {topSpots?.length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>TOP SPOTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(topSpots as TopSpot[]).slice(0, 8).map((spot: TopSpot, i: number) => (
              <div key={spot.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? C.gold : C.muted, width: 16 }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{spot.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {spot.avgRating && <span style={{ fontSize: 10, color: C.gold }}>⭐ {spot.avgRating}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{spot.count}</span>
                  </div>
                </div>
                <MiniBar value={spot.count} max={maxSpot} color={i === 0 ? C.sky : `${C.sky}70`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating distribution */}
      <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>RATING VERDELING</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[5, 4, 3, 2, 1].map(r => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ratingColors[r], width: 40 }}>{ratingLabels[r]}</span>
              <MiniBar value={(ratingDist as Record<string, number>)[r] || 0} max={maxRating} color={ratingColors[r]} />
              <span style={{ fontSize: 11, color: C.muted, width: 24, textAlign: "right" }}>{(ratingDist as Record<string, number>)[r] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top loggers */}
      {topUsers?.length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 12, letterSpacing: "0.06em" }}>TOP LOGGERS</div>
          {(topUsers as TopUser[]).map((u: TopUser, i: number) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topUsers.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <span style={{ fontSize: 14, width: 20 }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.navy }}>{u.name}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{u.count} sessies</span>
            </div>
          ))}
        </div>
      )}

      {/* Reactions */}
      {Object.keys(reactionCounts).length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "14px 16px", boxShadow: C.cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: "0.06em" }}>REACTIES</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(reactionCounts).map(([type, count]) => (
              <div key={type} style={{ flex: 1, textAlign: "center", padding: "10px 8px", background: C.oceanTint, borderRadius: 10 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🤙</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.sky }}>{count as number}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>stoked</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FINANCIËN TAB
   ══════════════════════════════════════════════════════════════ */

// Vaste maandelijkse kosten — gebaseerd op bekende services

export { StatsTab, MiniBar, SparkBar };