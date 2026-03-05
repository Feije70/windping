"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, isTokenExpired, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

interface SessionData {
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
  wind_feel: string | null;
  image_url: string | null;
  _spotName?: string;
}

async function apiPatch(body: any) {
  const token = await getValidToken();
  const res = await fetch("/api/sessions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sbGet(path: string) {
  const token = await getValidToken();
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Rating ──
const RATINGS = [
  { value: 1, label: "Shit" },
  { value: 2, label: "Mwah" },
  { value: 3, label: "Oké" },
  { value: 4, label: "Lekker!" },
  { value: 5, label: "EPIC!" },
];
const RATING_COLORS: Record<number, string> = {
  1: "#C97A63", 2: C.amber, 3: C.gold, 4: C.sky, 5: C.green,
};

function RatingIcon({ value, selected, size = 32 }: { value: number; selected: boolean; size?: number }) {
  const color = selected ? RATING_COLORS[value] : "#B0BAC5";
  const icons: Record<number, React.ReactNode> = {
    1: (<>
      <path d="M4 18 Q16 18 28 18" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M4 23 Q16 23 24 23" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
    </>),
    2: (<>
      <path d="M4 16 Q10 14 16 16 Q22 18 28 16" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M6 22 Q12 20 18 22 Q24 24 28 22" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5" />
    </>),
    3: (<>
      <path d="M3 13 Q8 9 14 13 Q20 17 26 13" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M5 20 Q10 17 16 20 Q22 23 28 20" stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none" opacity="0.6" />
    </>),
    4: (<>
      <path d="M2 12 Q8 6 15 12 Q22 18 28 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M4 20 Q10 15 17 20 Q24 25 30 18" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.65" />
    </>),
    5: (<>
      <path d="M2 14 Q6 6 13 14 Q20 22 27 11" stroke={color} strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M1 22 Q5 15 12 22 Q19 29 26 19" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="28" cy="7" r="2" fill={color} opacity="0.3" />
      <circle cx="4" cy="8" r="1.5" fill={color} opacity="0.25" />
    </>),
  };
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none">{icons[value]}</svg>;
}

// ── Propulsion icons ──
function PropIcon({ id, selected, size = 44 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? C.sky : "#B0BAC5";
  if (id === "kite") return (
    // Kite: inflatable leading edge arc with bridle lines — like wing but with lines to bar
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Main canopy — arc shape like a real kite */}
      <path d="M8 28 Q22 6 36 28"
        fill={`${color}20`}
        stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Leading edge tube */}
      <path d="M8 28 Q22 6 36 28"
        stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Center strut */}
      <line x1="22" y1="10" x2="22" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
      {/* Bridle lines to bar */}
      <line x1="12" y1="26" x2="22" y2="40" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <line x1="32" y1="26" x2="22" y2="40" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Bar */}
      <path d="M16 40 L28 40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (id === "wing") return (
    // Wing: similar arc but with handles, no lines
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      {/* Main canopy */}
      <path d="M8 28 Q22 6 36 28"
        fill={`${color}20`}
        stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Leading edge tube */}
      <path d="M8 28 Q22 6 36 28"
        stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Center strut */}
      <line x1="22" y1="10" x2="22" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
      {/* Handles (no lines to bar) */}
      <circle cx="15" cy="24" r="2.5" fill={color} opacity="0.5" />
      <circle cx="29" cy="24" r="2.5" fill={color} opacity="0.5" />
      {/* Handle grip lines */}
      <line x1="15" y1="24" x2="15" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="24" x2="29" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  // Zeil
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <line x1="20" y1="38" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 6 L34 14 L20 30" fill={`${color}20`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 38 Q20 36 30 38" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Board types ──
const KITE_BOARD_TYPES = [
  { id: "twintip", label: "Twintip" },
  { id: "directional", label: "Directional" },
  { id: "wave", label: "Wave" },
  { id: "strapless", label: "Strapless" },
];
const WING_BOARD_TYPES = [
  { id: "wingboard", label: "Wingboard" },
  { id: "sup", label: "SUP" },
];
const WINDSURF_BOARD_TYPES = [
  { id: "freeride", label: "Freeride" },
  { id: "wave", label: "Wave" },
  { id: "freestyle", label: "Freestyle" },
  { id: "slalom", label: "Race / Slalom" },
];

// ── Wind feel ──
const WIND_FEELS = [
  { id: "underpowered", label: "Te weinig" },
  { id: "perfect", label: "Perfect" },
  { id: "overpowered", label: "Te veel" },
  { id: "gusty", label: "Gusty" },
];

function WindFeelIcon({ id, selected, size = 28 }: { id: string; selected: boolean; size?: number }) {
  const color = selected ? C.sky : "#B0BAC5";
  const icons: Record<string, React.ReactNode> = {
    underpowered: (<>
      <path d="M4 14 Q10 12 16 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M6 20 Q10 18 14 20" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4" />
    </>),
    perfect: (<>
      <path d="M3 10 Q8 6 14 10 Q20 14 26 10" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M5 17 Q10 14 16 17 Q22 20 28 17" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="24" cy="6" r="3" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M24 3 L24 2 M27 6 L28 6 M24 9 L24 10 M21 6 L20 6" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </>),
    overpowered: (<>
      <path d="M2 8 Q6 3 12 8 Q18 13 24 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M4 15 Q8 10 14 15 Q20 20 26 13" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M6 22 Q10 18 16 22 Q22 26 28 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
    </>),
    gusty: (<>
      <path d="M4 8 L14 8 Q18 8 16 12" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M6 15 L20 15 Q24 15 22 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M4 22 L12 22 Q15 22 13 25" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
    </>),
  };
  return <svg width={size} height={size} viewBox="0 0 28 28" fill="none">{icons[id]}</svg>;
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 40px", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < current ? C.sky : C.cardBorder,
          transition: "background 0.3s ease",
        }} />
      ))}
    </div>
  );
}

/* ── Main ── */
function SessionLogInner() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("id");

  const [step, setStep] = useState(0);
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spotName, setSpotName] = useState("");

  const [rating, setRating] = useState<number | null>(null);
  const [propulsion, setPropulsion] = useState<"kite" | "wing" | "zeil" | null>(null);
  const [boardType, setBoardType] = useState<string | null>(null);
  const [boardOrFoil, setBoardOrFoil] = useState<"board" | "foil" | null>(null);
  const [sailSize, setSailSize] = useState("");
  const [boardLength, setBoardLength] = useState("");
  const [windFeel, setWindFeel] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const lastSavedSessionRef = useRef<{ id: number; spotName: string; rating: number | null; imageUrl: string | null } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const TOTAL_STEPS = 6;

  // ── Load spot name for a single session ──
  async function fetchSpotName(spotId: number, token: string): Promise<string> {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=eq.${spotId}&select=display_name`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data?.[0]?.display_name || "";
    } catch {
      return "";
    }
  }

  const loadSessions = useCallback(async () => {
    try {
      if (isTokenExpired()) { window.location.href = "/login"; return; }
      const authId = getAuthId();
      if (!authId) return;
      const users = await sbGet(`users?auth_id=eq.${encodeURIComponent(authId)}&select=id`);
      if (!users?.length) return;
      const userId = users[0].id;
      const token = await getValidToken();

      if (sessionIdParam) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionIdParam}&created_by=eq.${userId}&select=id,spot_id,session_date,status,rating,gear_type,gear_size,notes,forecast_wind,forecast_dir,wind_feel,image_url`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data?.length) {
          const name = await fetchSpotName(data[0].spot_id, token ?? "");
          data[0]._spotName = name;
          setSessions(data);
          setSession(data[0]);
          setSpotName(name);
          setStep(1);
        }
      } else {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${userId}&status=eq.going&session_date=lte.${today}&order=session_date.desc&select=id,spot_id,session_date,status,rating,gear_type,gear_size,notes,forecast_wind,forecast_dir,wind_feel,image_url`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data?.length) {
          // Fetch all spot names in parallel
          const spotIds = [...new Set(data.map((s: any) => s.spot_id))] as number[];
          const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=in.(${spotIds.join(",")})&select=id,display_name`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          const spotData = await spotRes.json();
          const spotMap: Record<number, string> = {};
          (spotData || []).forEach((s: any) => { spotMap[s.id] = s.display_name; });
          data.forEach((s: any) => { s._spotName = spotMap[s.spot_id] || `spot ${s.spot_id}`; });
          setSessions(data);
          setSession(data[0]);
          setSpotName(data[0]._spotName);
          setStep(1);
        } else {
          setStep(-1);
        }
      }
    } catch (e) { console.error(e); setError("Kon sessie niet laden"); }
  }, [sessionIdParam]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  function resetForNext() {
    setRating(null); setPropulsion(null); setBoardType(null);
    setSailSize(""); setBoardLength(""); setWindFeel(null); setBoardOrFoil(null);
    setNotes(""); setPhotoUrl(null); photoUrlRef.current = null; setError("");
  }

  function buildGearType(): string {
    const parts: string[] = [];
    if (propulsion) parts.push(propulsion === "zeil" ? "windsurf" : propulsion);
    if (boardOrFoil === "foil") parts.push("foil");
    else if (boardType) parts.push(boardType);
    return parts.join("-") || "unknown";
  }

  function buildGearSize(): string | null {
    const parts: string[] = [];
    if (sailSize.trim()) parts.push(sailSize.trim());
    if (boardLength.trim()) parts.push(`board ${boardLength.trim()}cm`);
    return parts.length ? parts.join(", ") : null;
  }

  const saveSession = async () => {
    if (!session || !rating) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiPatch({
        session_id: session.id,
        status: "completed",
        rating,
        gear_type: buildGearType(),
        gear_size: buildGearSize(),
        wind_feel: windFeel,
        notes: notes || null,
        photo_url: photoUrlRef.current || photoUrl || null,
      });
      if (result.error) { setError(result.error); setSaving(false); return; }
      // Store last saved session for sharing
      lastSavedSessionRef.current = {
        id: session.id,
        spotName: spotName,
        rating: rating,
        imageUrl: photoUrlRef.current || photoUrl || null,
      };
      const nextIndex = currentIndex + 1;
      if (nextIndex < sessions.length) {
        setCurrentIndex(nextIndex);
        const next = sessions[nextIndex];
        setSession(next);
        setSpotName(next._spotName || "");
        resetForNext();
        setStep(1);
      } else {
        setStep(7);
      }
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const skipSession = async () => {
    if (!session) return;
    await apiPatch({ session_id: session.id, status: "skipped" });
    const nextIndex = currentIndex + 1;
    if (nextIndex < sessions.length) {
      setCurrentIndex(nextIndex);
      const next = sessions[nextIndex];
      setSession(next);
      setSpotName(next._spotName || "");
      resetForNext();
      setStep(1);
    } else {
      setStep(6);
    }
  };

  const dateLabel = session ? (() => {
    const d = new Date(session.session_date + "T12:00:00");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Vandaag";
    if (diff === -1) return "Gisteren";
    return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  })() : "";

  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) {
      // step 4 = board type: back to foil/board choice (wing/windsurf) or propulsion (kite)
      if (propulsion === "kite") setStep(3);
      else setStep(3);
    }
    else if (step === 5) {
      // step 5 = sizes: back to board type (if board) or foil/board choice (if foil)
      if (boardOrFoil === "foil") setStep(3);
      else setStep(4);
    }
    else if (step === 6) setStep(5);
    else window.location.href = "/";
  }

  const boardTypesForPropulsion = propulsion === "zeil" ? WINDSURF_BOARD_TYPES
    : propulsion === "wing" ? WING_BOARD_TYPES
    : KITE_BOARD_TYPES;

  const stepNum = Math.min(step, TOTAL_STEPS);

  /* ── Loading ── */
  if (step === 0) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: C.muted }}>Sessie laden...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── No sessions ── */
  if (step === -1) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 340 }}>
        <h2 style={{ ...h, fontSize: 22, color: C.navy, margin: "0 0 8px" }}>Geen sessies om te loggen</h2>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: "0 0 24px" }}>
          Klik &apos;Ik ga!&apos; bij een Go-alert om een sessie te starten.
        </p>
        <Link href="/" style={{ display: "inline-block", padding: "12px 28px", background: C.sky, color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          ← Terug naar home
        </Link>
      </div>
    </div>
  );

  /* ── Done ── */
  if (step === 7) {
    const saved = lastSavedSessionRef.current;
    const shareUrl = saved ? `https://www.windping.com/sessie/${saved.id}` : "https://www.windping.com";
    const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
    const shareText = saved
      ? `${ratingLabels[saved.rating || 3] || "Top"} sessie op ${saved.spotName}! 🤙 ${shareUrl}`
      : `Zojuist een sessie gelogd op WindPing! 🤙 ${shareUrl}`;

    const canShare = typeof navigator !== "undefined" && !!navigator.share;

    const handleShare = async () => {
      if (!canShare) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link gekopieerd!");
        return;
      }
      try {
        const shareData: ShareData = {
          title: `WindPing — ${saved?.spotName || "Sessie"}`,
          text: shareText,
          url: shareUrl,
        };
        await navigator.share(shareData);
      } catch (e) {
        // User cancelled or error
      }
    };

    const handleWhatsApp = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    };

    return (
      <div style={{ background: C.cream, minHeight: "100vh", padding: "40px 20px 60px" }}>
        <div style={{ maxWidth: 380, margin: "0 auto" }}>
          {/* Success header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <svg width="64" height="64" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 12, animation: "popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}>
              <circle cx="18" cy="18" r="16" fill={`${C.green}15`} stroke={C.green} strokeWidth="2" />
              <path d="M11 18 L16 23 L26 13" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 style={{ ...h, fontSize: 26, color: C.navy, margin: "0 0 6px" }}>Gelogd! 🤙</h2>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: 0 }}>
              {sessions.length === 1 ? `Je sessie op ${saved?.spotName || spotName} is opgeslagen.` : `${sessions.length} sessies opgeslagen.`}
            </p>
          </div>

          {/* Share card preview */}
          <div style={{
            background: C.navy, borderRadius: 20, overflow: "hidden",
            marginBottom: 20, boxShadow: "0 8px 32px rgba(31,53,76,0.25)",
          }}>
            {saved?.imageUrl && (
              <img src={saved.imageUrl} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
            )}
            <div style={{ padding: "16px 18px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 4 }}>WINDPING</div>
                  <div style={{ ...h, fontSize: 20, fontWeight: 800, color: "#fff" }}>{saved?.spotName || spotName}</div>
                </div>
                {saved?.rating && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.green, marginTop: 16 }}>
                    {ratingLabels[saved.rating]}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>windping.com</div>
            </div>
          </div>

          {/* Share buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {/* Primary share button */}
            <button onClick={handleShare} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "15px", background: C.sky, color: "#fff",
              border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 16px ${C.sky}40`,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {canShare ? "Deel sessie" : "Kopieer link"}
            </button>

            {/* WhatsApp */}
            <button onClick={handleWhatsApp} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "15px", background: "#25D366", color: "#fff",
              border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Deel via WhatsApp
            </button>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/" style={{ display: "block", padding: "13px", background: C.card, color: C.navy, borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
              Terug naar home
            </Link>
          </div>
        </div>
        <style>{`@keyframes popIn{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  /* ── Flow ── */
  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={goBack} style={{ fontSize: 12, color: C.sky, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            ← Terug
          </button>
          {sessions.length > 1 && (
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{currentIndex + 1} / {sessions.length}</span>
          )}
          <button onClick={skipSession} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Overslaan →
          </button>
        </div>

        {/* Session info */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: C.sub, fontWeight: 600, marginBottom: 2 }}>{dateLabel}</div>
          <h1 style={{ ...h, fontSize: 26, color: C.navy, margin: "0 0 6px", letterSpacing: -0.5 }}>{spotName}</h1>
          {session?.forecast_wind && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", background: C.goBg, borderRadius: 20, fontSize: 13 }}>
              <span style={{ fontWeight: 800, color: C.green }}>{session.forecast_wind}kn</span>
              <span style={{ color: C.sub }}>{session.forecast_dir}</span>
            </div>
          )}
        </div>

        <StepDots total={TOTAL_STEPS} current={stepNum} />

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 12, color: "#DC2626", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Rating ── */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Hoe was het?</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 28px" }}>Geef je sessie een eerlijke beoordeling</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {RATINGS.map(r => (
                <button key={r.value} onClick={() => { setRating(r.value); setTimeout(() => setStep(2), 280); }} style={{
                  width: 58, padding: "14px 0", borderRadius: 16,
                  border: `2px solid ${rating === r.value ? RATING_COLORS[r.value] : C.cardBorder}`,
                  background: rating === r.value ? `${RATING_COLORS[r.value]}12` : C.card,
                  cursor: "pointer", transition: "all 0.2s",
                  transform: rating === r.value ? "scale(1.12)" : "scale(1)",
                  boxShadow: rating === r.value ? `0 6px 20px ${RATING_COLORS[r.value]}35` : C.cardShadow,
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <RatingIcon value={r.value} selected={rating === r.value} size={32} />
                  <div style={{ fontSize: 9, fontWeight: 800, color: rating === r.value ? RATING_COLORS[r.value] : C.muted, marginTop: 6 }}>{r.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Propulsion ── */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Wat reed je?</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 24px" }}>Kite, wing of sail?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {(["kite", "wing", "zeil"] as const).map(p => (
                <button key={p} onClick={() => { setPropulsion(p); setStep(p === "kite" ? 4 : 3); }} style={{
                  padding: "22px 10px", borderRadius: 16,
                  border: `2px solid ${propulsion === p ? C.sky : C.cardBorder}`,
                  background: propulsion === p ? `${C.sky}12` : C.card,
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: propulsion === p ? `0 4px 16px ${C.sky}25` : C.cardShadow,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                }}>
                  <PropIcon id={p} selected={propulsion === p} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: propulsion === p ? C.sky : C.navy, textTransform: "capitalize" }}>{p === "zeil" ? "Sail" : p.charAt(0).toUpperCase() + p.slice(1)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Foil or Board (wing/windsurf only) ── */}
        {step === 3 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Foil of board?</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 24px" }}>
              Wat had je onder je voeten?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={() => { setBoardOrFoil("foil"); setStep(5); }} style={{
                padding: "28px 16px", borderRadius: 16,
                border: `2px solid ${boardOrFoil === "foil" ? C.sky : C.cardBorder}`,
                background: boardOrFoil === "foil" ? `${C.sky}12` : C.card,
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: boardOrFoil === "foil" ? `0 4px 16px ${C.sky}25` : C.cardShadow,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  {/* Foil: mast + fuselage + wings */}
                  <line x1="26" y1="8" x2="26" y2="40" stroke={boardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M10 34 L42 34" stroke={boardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M14 28 L38 28" stroke={boardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <rect x="19" y="5" width="14" height="6" rx="3" fill={boardOrFoil === "foil" ? `${C.sky}20` : "#B0BAC520"} stroke={boardOrFoil === "foil" ? C.sky : "#B0BAC5"} strokeWidth="1.5"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 700, color: boardOrFoil === "foil" ? C.sky : C.navy }}>Foil</div>
              </button>
              <button onClick={() => { setBoardOrFoil("board"); setStep(4); }} style={{
                padding: "28px 16px", borderRadius: 16,
                border: `2px solid ${boardOrFoil === "board" ? C.sky : C.cardBorder}`,
                background: boardOrFoil === "board" ? `${C.sky}12` : C.card,
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: boardOrFoil === "board" ? `0 4px 16px ${C.sky}25` : C.cardShadow,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  {/* Board: surfboard shape */}
                  <path d="M26 8 Q38 10 40 26 Q38 42 26 44 Q14 42 12 26 Q14 10 26 8Z"
                    fill={boardOrFoil === "board" ? `${C.sky}15` : "#B0BAC515"}
                    stroke={boardOrFoil === "board" ? C.sky : "#B0BAC5"} strokeWidth="1.8"/>
                  <line x1="26" y1="12" x2="26" y2="40" stroke={boardOrFoil === "board" ? C.sky : "#B0BAC5"} strokeWidth="1" opacity="0.3"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 700, color: boardOrFoil === "board" ? C.sky : C.navy }}>Board</div>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Board type ── */}
        {step === 4 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Welk type board?</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 20px" }}>
              {propulsion === "zeil" ? "Windsurf board type" : propulsion === "wing" ? "Board onder de wing" : "Kite board type"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {boardTypesForPropulsion.map(bt => (
                <button key={bt.id} onClick={() => { setBoardType(bt.id); setStep(5); }} style={{
                  padding: "16px 20px", borderRadius: 14, textAlign: "left",
                  border: `2px solid ${boardType === bt.id ? C.sky : C.cardBorder}`,
                  background: boardType === bt.id ? `${C.sky}10` : C.card,
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: boardType === bt.id ? `0 4px 16px ${C.sky}20` : C.cardShadow,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: boardType === bt.id ? C.sky : C.navy }}>{bt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: Sizes ── */}
        {step === 5 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Maten</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 24px" }}>Optioneel — wat had je op?</p>

            {/* Sail / kite / wing size — open text */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>
                {propulsion === "kite" ? "KITE (m²)" : propulsion === "wing" ? "WING (m²)" : "ZEIL (m²)"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sailSize}
                  onChange={e => setSailSize(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))}
                  placeholder={propulsion === "zeil" ? "7.6" : propulsion === "wing" ? "5.0" : "12"}
                  style={{
                    width: "100%", padding: "13px 48px 13px 16px", borderRadius: 12,
                    border: `1.5px solid ${sailSize ? C.sky : C.cardBorder}`,
                    fontSize: 16, color: C.navy, background: C.card,
                    boxSizing: "border-box", outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted, pointerEvents: "none" }}>m²</span>
              </div>
            </div>

            {/* Board length */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>
                BOARD LENGTE (cm)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={boardLength}
                  onChange={e => setBoardLength(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={propulsion === "zeil" ? "245" : "138"}
                  style={{
                    width: "100%", padding: "13px 48px 13px 16px", borderRadius: 12,
                    border: `1.5px solid ${boardLength ? C.sky : C.cardBorder}`,
                    fontSize: 16, color: C.navy, background: C.card,
                    boxSizing: "border-box", outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted, pointerEvents: "none" }}>cm</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={goBack} style={{ padding: "14px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", width: 60 }}>←</button>
              <button onClick={() => setStep(6)} style={{ flex: 1, padding: "14px", background: C.sky, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                {sailSize || boardLength ? "Volgende →" : "Overslaan →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Details ── */}
        {step === 6 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ ...h, fontSize: 22, textAlign: "center", margin: "0 0 4px", color: C.navy }}>Details</h2>
            <p style={{ textAlign: "center", fontSize: 13, color: C.sub, margin: "0 0 20px" }}>Hoe voelde het op het water?</p>

            {/* Wind feel */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 8, letterSpacing: 0.5 }}>HOE VOELDE DE WIND?</label>
              <div style={{ display: "flex", gap: 8 }}>
                {WIND_FEELS.map(w => (
                  <button key={w.id} onClick={() => setWindFeel(windFeel === w.id ? null : w.id)} style={{
                    flex: 1, padding: "12px 6px", borderRadius: 12,
                    border: `2px solid ${windFeel === w.id ? C.sky : C.cardBorder}`,
                    background: windFeel === w.id ? `${C.sky}12` : C.card,
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                  }}>
                    <WindFeelIcon id={w.id} selected={windFeel === w.id} size={26} />
                    <div style={{ fontSize: 9, fontWeight: 700, color: windFeel === w.id ? C.sky : C.muted, marginTop: 4 }}>{w.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, letterSpacing: 0.5 }}>NOTITIES (optioneel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Hoe was het water? Iets bijzonders? Tips voor de volgende keer?"
                rows={3}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.cardBorder}`, fontSize: 14, color: C.navy, background: C.card, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, outline: "none" }}
              />
            </div>

            {/* Photo */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 6, letterSpacing: 0.5 }}>FOTO (optioneel)</label>
              {photoUrl ? (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                  <img src={photoUrl} alt="Sessie foto" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
                  <button onClick={() => { setPhotoUrl(null); photoUrlRef.current = null; }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              ) : (
                <div
                  onClick={() => { if (!photoUploading) document.getElementById("photo-upload-input")?.click(); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 16px", borderRadius: 12, border: `2px dashed ${C.cardBorder}`, background: C.card, cursor: photoUploading ? "not-allowed" : "pointer" }}>
                  {photoUploading ? (
                    <>
                      <div style={{ width: 20, height: 20, border: `2px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      <div style={{ fontSize: 13, color: C.muted }}>Uploaden...</div>
                    </>
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Tik om foto toe te voegen</div>
                    </>
                  )}
                </div>
              )}
              <input
                id="photo-upload-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !session) return;
                  setPhotoUploading(true);
                  setError("");
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("session_id", String(session.id));
                    console.log("Starting upload, file size:", file.size, "type:", file.type);
                    const uploadRes = await fetch("/api/upload", {
                      method: "POST",
                      body: formData,
                    });
                    console.log("Upload response status:", uploadRes.status);
                    let uploadData: any = {};
                    try { uploadData = await uploadRes.json(); } catch (je) { uploadData = { error: "Ongeldige server response" }; }
                    console.log("Upload response data:", uploadData);
                    if (uploadRes.ok && uploadData.url) {
                      setPhotoUrl(uploadData.url);
                      photoUrlRef.current = uploadData.url;
                    } else {
                      setError(`Foto upload mislukt: ${uploadData.error || `HTTP ${uploadRes.status}`}`);
                    }
                  } catch (err: any) {
                    console.error("Upload exception:", err);
                    setError("Foto upload mislukt. Controleer je verbinding.");
                  }
                  setPhotoUploading(false);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Summary */}
            <div style={{ padding: "14px 16px", background: C.card, borderRadius: 14, boxShadow: C.cardShadow, marginBottom: 20, border: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10, letterSpacing: 0.5 }}>SAMENVATTING</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {rating && <RatingIcon value={rating} selected={true} size={36} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{spotName}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>
                    {dateLabel}
                    {propulsion && ` · ${propulsion === "zeil" ? "windsurf" : propulsion}`}
                    {boardType && ` ${boardType}`}
                    {sailSize && ` · ${sailSize}m²`}
                    {boardLength && ` · ${boardLength}cm`}
                    {windFeel && ` · ${WIND_FEELS.find(w => w.id === windFeel)?.label}`}
                  </div>
                </div>
                {rating && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: RATING_COLORS[rating], minWidth: 44, textAlign: "right" }}>
                    {RATINGS.find(r => r.value === rating)?.label}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={goBack} style={{ padding: "14px", background: C.card, color: C.sub, border: `1px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", width: 60 }}>←</button>
              <button onClick={saveSession} disabled={saving} style={{
                flex: 1, padding: "14px", background: C.green, color: "#fff",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Opslaan..." : "✓ Log sessie"}
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

export default function SessionLogPage() {
  return (
    <Suspense fallback={<div style={{ background: "#F6F1EB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 13, color: "#8A9BB0" }}>Laden...</div></div>}>
      <SessionLogInner />
    </Suspense>
  );
}