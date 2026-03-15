"use client";

import { useEffect, useState } from "react";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { Icons } from "@/components/Icons";
import { useUser } from "@/lib/hooks/useUser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import Link from "next/link";
import HomeSpotIcon from "@/components/HomeSpotIcon";

const h = { fontFamily: fonts.heading };

interface MySpot {
  id: number; name: string; type: string; windMin: number; windMax: number;
  dirs: string[]; enabled: boolean; epicEnabled: boolean; isPrivate: boolean;
}

const typeColors: Record<string, string> = { zee: "#1A6A80", meer: "#2A8A70", rivier: "#B07030" };
const typeGrad: Record<string, string> = {
  zee: "linear-gradient(90deg,#1A6A80,#2E8FAE)", meer: "linear-gradient(90deg,#2A8A70,#3EAA8C)",
  rivier: "linear-gradient(90deg,#B07030,#E8A83E)",
};

function MySpotCard({ spot, userId, token, onDelete, isHome, onSetHome, settingHome }: { spot: MySpot; userId: number; token: string; onDelete: () => void; isHome: boolean; onSetHome: () => void; settingHome: boolean }) {
  const [enabled, setEnabled] = useState(spot.enabled);
  const [deleting, setDeleting] = useState(false);
  const tc = typeColors[spot.type] || C.sky;
  const tg = typeGrad[spot.type] || C.sky;

  async function sbPatch(path: string, body: unknown) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "PATCH", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`supabase_${res.status}`);
  }

  async function sbDelete(path: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "DELETE", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
    });
  }

  async function toggleAlert() {
    const next = !enabled;
    setEnabled(next);
    try { await sbPatch(`ideal_conditions?user_id=eq.${userId}&spot_id=eq.${spot.id}`, { enabled: next }); }
    catch { setEnabled(!next); }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${spot.name}" from your spots?`)) return;
    setDeleting(true);
    try {
      await Promise.all([
        sbDelete(`user_spots?user_id=eq.${userId}&spot_id=eq.${spot.id}`),
        sbDelete(`ideal_conditions?user_id=eq.${userId}&spot_id=eq.${spot.id}`),
        ...(spot.isPrivate ? [sbDelete(`spots?id=eq.${spot.id}`)] : []),
      ]);
      onDelete();
    } catch { setDeleting(false); }
  }

  const homeBorder = isHome ? "2px solid #E8A83E" : `1px solid ${C.cardBorder}`;
  const homeTopBar = isHome ? "linear-gradient(90deg,#E8A83E,#F5C842)" : (spot.isPrivate ? "linear-gradient(90deg,#EA580C,#FB923C)" : tg);

  return (
    <a href={`/spot?id=${spot.id}`} style={{
      display: "block", background: C.card, borderRadius: 16,
      boxShadow: isHome ? "0 4px 20px rgba(232,168,62,0.18)" : C.cardShadow,
      border: homeBorder,
      overflow: "hidden", opacity: deleting ? 0.4 : 1, transition: "opacity 0.3s", cursor: "pointer",
      textDecoration: "none", color: "inherit",
    }}>
      <div style={{ height: 4, background: homeTopBar }} />

      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" as const }}>
            {isHome && <HomeSpotIcon size={18} />}
            <span style={{ fontSize: 16, fontWeight: 700, color: C.navy, lineHeight: 1.2 }}>{spot.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 8 }}>
            {spot.epicEnabled && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: "linear-gradient(135deg,rgba(232,168,62,0.2),rgba(232,168,62,0.35))", color: "#E8A83E", border: "1px solid rgba(232,168,62,0.4)" }}>🤙 Epic</span>
            )}
            {spot.isPrivate ? (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, padding: "3px 9px", borderRadius: 8, background: "rgba(234,88,12,0.15)", color: "#FB923C" }}>private</span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, padding: "3px 9px", borderRadius: 8, background: `${tc}20`, color: tc }}>{spot.type}</span>
            )}
          </div>
        </div>

        {isHome && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "5px 10px", borderRadius: 20, background: "rgba(232,168,62,0.12)", border: "1px solid rgba(232,168,62,0.3)" }}>
            <HomeSpotIcon size={13} />
            <span style={{ fontSize: 10, fontWeight: 800, color: "#C8860A", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Jouw homespot</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          {Icons.wind({ color: C.sky, size: 16 })}
          <span style={{ fontSize: 13, fontWeight: 600, color: C.sky }}>{spot.windMin}–{spot.windMax} kn</span>
        </div>

        <div style={{ marginBottom: 14, minHeight: 20, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {spot.dirs.length > 0 ? spot.dirs.map((d) => (
            <span key={d} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${C.sky}15`, color: C.sky }}>{d}</span>
          )) : <span style={{ color: C.sub, fontSize: 12 }}>No directions set</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${isHome ? "rgba(232,168,62,0.2)" : C.cardBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleAlert(); }} style={{
              width: 38, height: 22, borderRadius: 22, background: enabled ? C.sky : C.creamDark,
              cursor: "pointer", position: "relative", transition: "background 0.25s",
            }}>
              <div style={{ position: "absolute", top: 3, left: enabled ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.25s" }} />
            </div>
            <span style={{ fontSize: 12, color: enabled ? C.sky : C.sub, fontWeight: 500 }}>
              {enabled ? "Alerts on" : "Alerts off"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isHome && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetHome(); }} disabled={settingHome} style={{
                fontSize: 11, fontWeight: 600, color: C.muted, background: "none",
                border: `1px dashed ${C.cardBorder}`, borderRadius: 8, padding: "4px 9px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                <HomeSpotIcon size={13} color="#9CA3AF" flagColor="#E5E7EB" />
                {settingHome ? "Instellen..." : "Maak homespot"}
              </button>
            )}
            <Link href={`/spot?id=${spot.id}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, fontWeight: 600, color: C.sky, textDecoration: "none" }}>
              Edit →
            </Link>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }} disabled={deleting} style={{ fontSize: 16, color: C.amber, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>✕</button>
          </div>
        </div>
      </div>
    </a>
  );
}

interface RawUserSpot { spot_id: number; }
interface RawSpot { id: number; display_name: string; spot_type: string | null; min_wind: number | null; max_wind: number | null; good_directions: string[] | null; is_private: boolean | null; }
interface RawIdealCondition { spot_id: number; wind_min: number | null; wind_max: number | null; directions: string[] | null; enabled: boolean | null; perfect_enabled: boolean | null; }

export default function MySpotPage() {
  const { user, token, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [spots, setSpots] = useState<MySpot[]>([]);
  const [homeSpotId, setHomeSpotId] = useState<number | null>(null);
  const [settingHome, setSettingHome] = useState<number | null>(null);

  async function setAsHomeSpot(spotId: number) {
    if (!user || !token) return;
    setSettingHome(spotId);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: "PATCH", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ home_spot_id: spotId }),
      });
      if (!res.ok) throw new Error(`supabase_${res.status}`);
      setHomeSpotId(spotId);
    } catch {}
    setSettingHome(null);
  }

  useEffect(() => {
    if (!user || !token) return;

    async function load() {
      try {
        const uid = user!.id;

        async function sbFetch(path: string) {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token!}` },
          });
          if (res.status === 401) throw new Error("auth");
          if (!res.ok) throw new Error(`supabase_${res.status}`);
          return res.json();
        }

        const userData = await sbFetch(`users?id=eq.${uid}&select=home_spot_id`);
        if (userData?.[0]?.home_spot_id) setHomeSpotId(userData[0].home_spot_id);

        const userSpots = await sbFetch(`user_spots?user_id=eq.${uid}&select=spot_id`);
        if (!userSpots?.length) { setSpots([]); setLoading(false); return; }
        const ids = (userSpots as RawUserSpot[]).map(x => x.spot_id);

        const [spotsData, condsData] = await Promise.all([
          sbFetch(`spots?id=in.(${ids.join(",")})&select=id,display_name,spot_type,level,min_wind,max_wind,good_directions,is_private`),
          sbFetch(`ideal_conditions?user_id=eq.${uid}&spot_id=in.(${ids.join(",")})&select=spot_id,wind_min,wind_max,directions,enabled,perfect_enabled`),
        ]);

        const conds: Record<number, RawIdealCondition> = {};
        (condsData as RawIdealCondition[] || []).forEach(ic => { conds[ic.spot_id] = ic; });

        const result: MySpot[] = (spotsData as RawSpot[] || []).map(s => {
          const ic = conds[s.id];
          return {
            id: s.id,
            name: s.display_name || "Unknown spot",
            type: (s.spot_type || "other").toLowerCase(),
            windMin: ic?.wind_min ?? s.min_wind ?? 15,
            windMax: ic?.wind_max ?? s.max_wind ?? 25,
            dirs: ic?.directions?.length ? ic.directions : (s.good_directions || []),
            enabled: ic ? ic.enabled !== false : true,
            epicEnabled: ic?.perfect_enabled === true,
            isPrivate: s.is_private === true,
          };
        });

        setSpots(result);
      } catch (e) {
        console.error("My spots error:", e);
      }
      setLoading(false);
    }
    load();
  }, [user, token]);

  if (authLoading) return null;

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 2, color: C.navy, margin: 0 }}>My Spots</h1>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${C.sky}20`, color: C.sky }}>{spots.length}</span>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          </div>
        )}

        {!loading && spots.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", background: C.card, borderRadius: 18, boxShadow: C.cardShadow, border: `2px dashed ${C.cardBorder}` }}>
            {Icons.mapPin({ color: C.sub, size: 40 })}
            <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "16px 0 8px" }}>No spots saved yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Browse spots and add your favorites.</div>
            <Link href="/spots" style={{ display: "inline-block", padding: "10px 24px", background: C.sky, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 10, textDecoration: "none" }}>
              Discover spots →
            </Link>
          </div>
        )}

        {!loading && spots.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {spots.map((s) => (
                <MySpotCard key={s.id} spot={s} userId={user!.id} token={token!}
                  isHome={homeSpotId === s.id}
                  onSetHome={() => setAsHomeSpot(s.id)}
                  settingHome={settingHome === s.id}
                  onDelete={() => setSpots((prev) => prev.filter((p) => p.id !== s.id))}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <Link href="/spots" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px",
                background: C.card, boxShadow: C.cardShadow, borderRadius: 14,
                fontSize: 13, fontWeight: 600, color: C.sky, textDecoration: "none", minWidth: 180,
              }}>
                {Icons.plus({ color: C.sky })} Spots zoeken
              </Link>
              <Link href="/add-spot" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px",
                background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, border: "none", borderRadius: 14,
                fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none", minWidth: 180,
              }}>
                {Icons.mapPin({ color: "#fff", size: 16 })} Eigen spot maken
              </Link>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}