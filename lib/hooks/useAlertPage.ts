/* ── lib/hooks/useAlertPage.ts ────────────────────────────
   Data fetching hook voor de alert pagina.
   Bevat alle state, data fetching en handlers.
──────────────────────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type {
  DbAlertHistory,
  DbSession,
  HourlyWindData,
  TideData,
  WindPingUser,
  SessionCompleteUpdate,
  SessionWithSpotName,
} from "@/lib/types";

// WindPingUser is gedefinieerd in useUser — re-exporteer vanuit types
export type { WindPingUser };

// ── Types ────────────────────────────────────────────────────────────────────

export type { HourlyWindData };

export interface LogForm {
  rating: number;
  wind_feel: string;
  gear_type: string;
  gear_size: string;
  duration_minutes: number;
  notes: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIRS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"] as const;

function degToDir(deg: number): string {
  return DIRS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

async function uploadSessionPhoto(
  file: File,
  userId: number,
  sessionId: number,
  token: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${sessionId}_${Date.now()}.${ext}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/session-photos/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!uploadRes.ok) { console.error("Photo upload failed:", await uploadRes.text()); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/session-photos/${path}`;
  } catch (e) { console.error("Photo upload error:", e); return null; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAlertPage(user: WindPingUser | null, token: string | null) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  const [alerts, setAlerts] = useState<DbAlertHistory[]>([]);
  const [hourlyData, setHourlyData] = useState<Record<string, HourlyWindData[]>>({});
  const [tideData, setTideData] = useState<Record<string, TideData>>({});
  const [expandedPast, setExpandedPast] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [goingSessions, setGoingSessions] = useState<Record<string, DbSession>>({});
  const [logSession, setLogSession] = useState<SessionWithSpotName | null>(null);
  const [logForm, setLogForm] = useState<LogForm>({
    rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const loadAlerts = async () => {
    if (!user || !token) return;
    try {
      const uid = user.id;
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceStr = since.toISOString().split("T")[0];

      const alertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alert_history?user_id=eq.${uid}&target_date=gte.${sinceStr}&order=target_date.desc,created_at.desc&limit=10`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      const alertData: DbAlertHistory[] = await alertRes.json();
      setAlerts(alertData || []);

      const goAlerts = (alertData || []).filter(a => a.alert_type === "go" || a.alert_type === "heads_up");
      const downgradeAlerts = (alertData || []).filter(a => a.alert_type === "downgrade");
      const alertsNeedingHourly = [...goAlerts, ...downgradeAlerts];
      const hourlyMap: Record<string, HourlyWindData[]> = {};
      const tideMap: Record<string, TideData> = {};

      for (const alert of alertsNeedingHourly) {
        const spots = alert.conditions?.spots || [];
        for (const spot of spots) {
          const key = `${spot.spotId}_${alert.target_date}`;
          if (hourlyMap[key]) continue;

          const spotRes = await fetch(
            `${SUPABASE_URL}/rest/v1/spots?id=eq.${spot.spotId}&select=latitude,longitude,spot_type`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
          );
          const spotData: { latitude: number; longitude: number; spot_type: string | null }[] = await spotRes.json();
          if (!spotData?.[0]?.latitude) continue;
          const { latitude, longitude, spot_type } = spotData[0];
          const isPastDate = alert.target_date < todayStr;

          try {
            const omUrl = isPastDate
              ? `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${alert.target_date}&end_date=${alert.target_date}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam`
              : `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=Europe/Amsterdam&forecast_days=7`;

            const omRes = await fetch(omUrl);
            const omData: { hourly: { time: string[]; wind_speed_10m: number[]; wind_gusts_10m: number[]; wind_direction_10m: number[] } } = await omRes.json();

            if (omData?.hourly?.time) {
              const hours = [7, 9, 11, 13, 15, 17, 19, 21];
              const result: HourlyWindData[] = [];
              for (const hr of hours) {
                const target = `${alert.target_date}T${hr.toString().padStart(2, "0")}:00`;
                const idx = omData.hourly.time.indexOf(target);
                if (idx >= 0) {
                  result.push({
                    hour: hr,
                    wind: Math.round(omData.hourly.wind_speed_10m[idx] || 0),
                    gust: Math.round(omData.hourly.wind_gusts_10m[idx] || 0),
                    dir: degToDir(omData.hourly.wind_direction_10m[idx] || 0),
                  });
                }
              }
              hourlyMap[key] = result;
            }
          } catch {}

          if (spot_type?.toLowerCase() === "zee" && !tideMap[key]) {
            if (isPastDate) {
              const storedTides = alert.conditions?.tides?.[spot.spotId];
              if (storedTides?.length) {
                tideMap[key] = {
                  extremes: storedTides.map(t => ({ time: t.time, type: t.type, height: t.height })),
                };
              }
            } else {
              try {
                const exRes = await fetch(`/api/tide?spot_id=${spot.spotId}&lat=${latitude}&lng=${longitude}&type=extremes`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (exRes.ok) {
                  const ex: { data: { time: string; height: number; type: "high" | "low" }[]; station?: { name: string } } = await exRes.json();
                  tideMap[key] = {
                    extremes: (ex?.data || []).map(p => ({ time: p.time, height: p.height, type: p.type })),
                    station: ex?.station?.name,
                  };
                }
              } catch {}
            }
          }
        }
      }
      setHourlyData(hourlyMap);
      setTideData(tideMap);
    } catch (e) {
      console.error("Load alerts error:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !token) return;
    loadAlerts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) return;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${user.id}&select=id,spot_id,session_date,status,rating,photo_url`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
        );
        const data: DbSession[] = await res.json();
        const map: Record<string, DbSession> = {};
        (data || [])
          .filter(s => s.status !== "skipped")
          .forEach(s => { map[`${s.spot_id}_${s.session_date}`] = s; });
        setGoingSessions(map);
      } catch {}
    })();
  }, [user, token]);

  const handleIkGa = async (
    spotId: number,
    date: string,
    alertId: number,
    wind: number,
    gust: number,
    dir: string
  ) => {
    if (!user || !token) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          created_by: user.id,
          spot_id: spotId,
          session_date: date,
          alert_id: alertId,
          status: "going",
          going_at: new Date().toISOString(),
          forecast_wind: wind,
          forecast_gust: gust,
          forecast_dir: dir,
        }),
      });
      if (res.ok) {
        const data: DbSession[] = await res.json();
        setGoingSessions(prev => ({ ...prev, [`${spotId}_${date}`]: data[0] }));
      }
    } catch (e) { console.error("Ik ga error:", e); }
  };

  const handleSkip = async (spotId: number, date: string) => {
    if (!token) return;
    const key = `${spotId}_${date}`;
    const session = goingSessions[key];
    if (!session) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${session.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      setGoingSessions(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch {}
  };

  const handleCompleteSession = async () => {
    if (!logSession || saving || !token || !user) return;
    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        setPhotoUploading(true);
        photoUrl = await uploadSessionPhoto(photoFile, user.id, logSession.id, token);
        setPhotoUploading(false);
      }

      const update: SessionCompleteUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
      };
      if (logForm.rating > 0) update.rating = logForm.rating;
      if (logForm.wind_feel) update.wind_feel = logForm.wind_feel;
      if (logForm.gear_type) update.gear_type = logForm.gear_type;
      if (logForm.gear_size) update.gear_size = logForm.gear_size;
      if (logForm.duration_minutes > 0) update.duration_minutes = logForm.duration_minutes;
      if (logForm.notes) update.notes = logForm.notes;
      if (photoUrl) update.photo_url = photoUrl;

      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${logSession.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      });

      const key = `${logSession.spot_id}_${logSession.session_date}`;
      setGoingSessions(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: "completed",
          rating: logForm.rating,
          photo_url: photoUrl,
        },
      }));
      setLogSession(null);
      setLogForm({ rating: 0, wind_feel: "", gear_type: "", gear_size: "", duration_minutes: 0, notes: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e) { console.error("Complete session error:", e); }
    setSaving(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Foto is te groot (max 5MB)"); return; }
    if (!file.type.startsWith("image/")) { alert("Alleen afbeeldingen toegestaan"); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const alertsByDate: Record<string, DbAlertHistory[]> = {};
  for (const a of alerts) {
    if (!alertsByDate[a.target_date]) alertsByDate[a.target_date] = [];
    alertsByDate[a.target_date].push(a);
  }
  const sortedFutureDates = Object.keys(alertsByDate).filter(d => d >= todayStr).sort();
  const sortedPastDates = Object.keys(alertsByDate).filter(d => d < todayStr).sort().reverse();

  return {
    // state
    alerts, hourlyData, tideData,
    expandedPast, setExpandedPast,
    loading, goingSessions,
    logSession, setLogSession,
    logForm, setLogForm,
    saving, photoFile, photoPreview, setPhotoPreview, setPhotoFile, photoUploading,
    // computed
    alertsByDate, sortedFutureDates, sortedPastDates, todayStr,
    // handlers
    handleIkGa, handleSkip, handleCompleteSession, handlePhotoSelect,
  };
}
