/* ── app/components/SessionStatsSection.tsx ───────────────
   Sessie statistieken sectie op de homepage
──────────────────────────────────────────────────────────── */
"use client";

import Link from "next/link";
import { colors as C } from "@/lib/design";
import { RATING_COLORS } from "@/lib/constants/session";
import { RatingIcon } from "@/app/components/SessionIcons";

export interface SessionStats {
  total_sessions: number;
  total_spots: number;
  current_streak: number;
  longest_streak: number;
  avg_rating: number | null;
  favorite_spot_id: number | null;
  last_session_date: string | null;
  season_sessions: number;
  badges: string[];
}

export interface RecentSession {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: string | null;
  notes: string | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  photo_url: string | null;
  spots?: { display_name: string };
}

interface Props {
  stats: SessionStats;
  sessions: RecentSession[];
  spotNames: Record<number, string>;
}

const RATING_LABELS: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };

function dateLabelFn(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

export function SessionStatsSection({ stats, sessions, spotNames }: Props) {
  const completed = sessions.filter(s => s.status === "completed");
  const hasData = stats.total_sessions > 0 || completed.length > 0;

  if (!hasData) {
    return (
      <div style={{ padding: "24px 20px", background: C.card, boxShadow: C.cardShadow, borderRadius: 16, textAlign: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Nog geen sessies</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Klik &apos;Ik ga!&apos; bij je volgende Go-alert<br />om je eerste sessie te starten.</div>
      </div>
    );
  }

  const favSpotName = stats.favorite_spot_id ? (spotNames[stats.favorite_spot_id] || "–") : "–";
  const latest = completed[0];
  const latestSpot = latest ? (latest.spots?.display_name || spotNames[latest.spot_id] || "Spot") : null;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { val: String(stats.total_sessions), label: "Sessies", color: C.navy },
          { val: String(stats.current_streak), label: "Streak", color: C.sky },
          { val: stats.avg_rating ? stats.avg_rating.toFixed(1) : "–", label: "Gem. rating", color: C.gold },
        ].map((s) => (
          <div key={s.label} style={{ padding: "14px 10px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: "12px 14px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{stats.total_spots}</div>
            <div style={{ fontSize: 10, color: C.sub }}>Spots bezocht</div>
          </div>
        </div>
        <div style={{ padding: "12px 14px", background: C.card, boxShadow: C.cardShadow, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.epicBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{favSpotName}</div>
            <div style={{ fontSize: 10, color: C.sub }}>Favoriete spot</div>
          </div>
        </div>
      </div>

      {latest && (
        <Link href={`/sessie/${latest.id}`} style={{ display: "block", textDecoration: "none", marginBottom: 12 }}>
          <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 16, overflow: "hidden" }}>
            {latest.photo_url && (
              <div style={{ position: "relative" }}>
                <img src={latest.photo_url} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(31,53,76,0.85) 100%)" }} />
                <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{latestSpot}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{dateLabelFn(latest.session_date)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {latest.forecast_wind && (
                      <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "5px 9px", textAlign: "center" }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{latest.forecast_wind}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>KN</div>
                      </div>
                    )}
                    {latest.rating && (
                      <div style={{ fontSize: 13, fontWeight: 800, color: RATING_COLORS[latest.rating], background: `${RATING_COLORS[latest.rating]}25`, padding: "4px 10px", borderRadius: 16 }}>
                        {RATING_LABELS[latest.rating]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div style={{ padding: "12px 14px" }}>
              {!latest.photo_url && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{latestSpot}</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{dateLabelFn(latest.session_date)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {latest.forecast_wind && <div style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{latest.forecast_wind}<span style={{ fontSize: 10 }}>kn</span></div>}
                    {latest.rating && <div style={{ fontSize: 12, fontWeight: 800, color: RATING_COLORS[latest.rating] }}>{RATING_LABELS[latest.rating]}</div>}
                  </div>
                </div>
              )}
              {(latest.gear_type || latest.gear_size) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {latest.gear_type && <span style={{ fontSize: 11, fontWeight: 600, color: C.sky, background: C.sky + "12", borderRadius: 7, padding: "3px 9px" }}>{latest.gear_type.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}</span>}
                  {latest.gear_size && <span style={{ fontSize: 11, color: C.sub, padding: "3px 0" }}>{latest.gear_size}</span>}
                  {latest.notes && <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{latest.notes}</div>}
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

      {stats.total_sessions > 3 && (
        <Link href="/mijn-sessies" style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 12, color: C.sky, fontWeight: 600, textDecoration: "none" }}>
          Alle {stats.total_sessions} sessies bekijken →
        </Link>
      )}
    </div>
  );
}
