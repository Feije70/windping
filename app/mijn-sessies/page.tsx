"use client";
import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import PhotoCropModal from "@/app/components/PhotoCropModal";
import { cropStyle } from "@/lib/cropStyle";
import { getValidToken, isTokenExpired, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

interface Session {
  id: number;
  spot_id: number;
  session_date: string;
  status: string;
  rating: number | null;
  gear_type: string | null;
  gear_size: string | null;
  forecast_wind: number | null;
  forecast_dir: string | null;
  wind_feel: string | null;
  notes: string | null;
  photo_url: string | null;
  photo_crop: string | null;
  image_url: string | null;
  _spotName?: string;
}

const ratingLabels: Record<number, string> = { 1: "Shit", 2: "Mwah", 3: "Oké", 4: "Lekker!", 5: "EPIC!" };
const ratingColors: Record<number, string> = { 1: "#C97A63", 2: C.amber, 3: C.gold, 4: C.sky, 5: C.green };
const windFeelLabels: Record<string, string> = { perfect: "Perfect", underpowered: "Te weinig", overpowered: "Te veel", gusty: "Gusty" };
const isJson = (v: string | null) => !!v && (v.startsWith("{") || v.startsWith("["));

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - todayD.getTime()) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function SessionCard({ s, onClick }: { s: Session; onClick: () => void }) {
  const spot = s._spotName || "Spot";
  const shareUrl = `https://www.windping.com/sessie/${s.id}`;
  const shareText = [s.rating ? ({1:"Shit",2:"Mwah",3:"Oké",4:"Lekker!",5:"EPIC!"}[s.rating as 1|2|3|4|5]||"Sessie") : "Sessie gelogd", `${spot}${s.forecast_wind ? ` · ${s.forecast_wind}kn` : ""}${s.forecast_dir ? ` ${s.forecast_dir}` : ""}`, "via WindPing"].join("\n");
  const handleShare = async (e: React.MouseEvent) => { e.stopPropagation(); if ((navigator as any).share) { try { await (navigator as any).share({ title: `${spot} · WindPing`, text: shareText, url: shareUrl }); return; } catch {} } try { await navigator.clipboard.writeText(shareUrl); alert("Link gekopieerd! 🤙"); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank"); } };
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
  return (
    <div style={{ marginBottom: 12 }}>
    <div onClick={onClick} style={{
      background: C.card, boxShadow: C.cardShadow, borderRadius: 16,
      overflow: "hidden", cursor: "pointer",
      borderLeft: s.rating ? `3px solid ${ratingColors[s.rating]}` : `3px solid ${C.cardBorder}`,
    }}>
      {(s.photo_url || s.image_url) && (
        <div style={{ position: "relative" }}>
          <img src={s.photo_url || s.image_url || ""} alt="" style={{ width: "100%", height: 160, display: "block", ...cropStyle(s.photo_crop) }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 14, right: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{spot}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>{dateLabel(s.session_date)}</div>
            </div>
            {s.forecast_wind && (
              <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "5px 9px", textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{s.forecast_wind}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>KN</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        {!(s.photo_url || s.image_url) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{spot}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{dateLabel(s.session_date)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {s.forecast_wind && <div style={{ fontSize: 15, fontWeight: 800, color: C.sky }}>{s.forecast_wind}<span style={{ fontSize: 10 }}>kn</span></div>}
              {s.rating && <div style={{ fontSize: 12, fontWeight: 800, color: ratingColors[s.rating] }}>{ratingLabels[s.rating]}</div>}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          {s.gear_type && !isJson(s.gear_type) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.sky, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>
                {s.gear_type.replace(/^zeil/, "windsurf").replace(/-/g, " ")}{s.gear_size && !isJson(s.gear_size) ? ` ${s.gear_size}m²` : ""}
              </span>
            </div>
          )}
          {s.wind_feel && (
            <>
              {s.gear_type && <span style={{ color: C.muted, fontSize: 11 }}>·</span>}
              <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>{windFeelLabels[s.wind_feel] || s.wind_feel}</span>
            </>
          )}
        </div>
        {s.notes && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {s.notes}
          </div>
        )}
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <button onClick={handleShare} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: C.sky, border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Deel
      </button>
      <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: "#25D366", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </a>
    </div>
    </div>
  );
}

function SessionDetail({ s, onClose }: { s: Session; onClose: () => void }) {
  const spot = s._spotName || "Spot";
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [showCrop, setShowCrop] = React.useState(false);
  const [cropSaving, setCropSaving] = React.useState(false);

  const saveCrop = async (cropString: string) => {
    setCropSaving(true);
    try {
      const token = await getValidToken();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${s.id}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ photo_crop: cropString }),
      });
      console.log("saveCrop status:", r.status, await r.text());
      setShowCrop(false);
      window.location.reload();
    } catch (e) { console.error("saveCrop error:", e); setCropSaving(false); }
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getValidToken();
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${s.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
      });
      onClose();
      window.location.reload();
    } catch { setDeleting(false); }
  }

  const shareUrl = `https://www.windping.com/sessie/${s.id}`;
  const shareText = [
    s.rating ? ratingLabels[s.rating] : "Sessie gelogd",
    `${spot}${s.forecast_wind ? ` · ${s.forecast_wind}kn` : ""}${s.forecast_dir ? ` ${s.forecast_dir}` : ""}`,
    "via WindPing",
  ].join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `${spot} · WindPing`, text: shareText, url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(shareUrl); alert("Link gekopieerd! 🤙"); } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank");
    }
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: C.cream, overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.cream, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style={{ ...h, fontSize: 17, fontWeight: 700, color: C.navy }}>Sessie detail</span>
      </div>
      <div style={{ padding: "0 16px 120px" }}>
        {(s.photo_url || s.image_url) && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16, position: "relative" }}>
            <img src={s.photo_url || s.image_url || ""} alt="" style={{ width: "100%", maxHeight: 280, display: "block", ...cropStyle(s.photo_crop) }} />
            <button onClick={() => setShowCrop(true)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✂️ Bijsnijden</button>
          </div>
        )}
        <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 16, padding: "16px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy }}>{spot}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{dateLabel(s.session_date)}</div>
            </div>
            {s.forecast_wind && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.sky, lineHeight: 1 }}>{s.forecast_wind}<span style={{ fontSize: 12 }}>kn</span></div>
                {s.forecast_dir && <div style={{ fontSize: 11, color: C.sub }}>{s.forecast_dir}</div>}
              </div>
            )}
          </div>
          {s.rating && (
            <div style={{ fontSize: 18, fontWeight: 800, color: ratingColors[s.rating] }}>{ratingLabels[s.rating]}</div>
          )}
        </div>

        {(s.gear_type || s.wind_feel) && (
          <div style={{ display: "grid", gridTemplateColumns: s.gear_type && s.wind_feel ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 12 }}>
            {s.gear_type && !isJson(s.gear_type) && (
              <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 4 }}>GEAR</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
                  {s.gear_type.replace(/^zeil\b/, "windsurf").replace(/-/g, " ")}
                  {s.gear_size && !isJson(s.gear_size) && <span style={{ fontSize: 13, color: C.sub }}> · {s.gear_size}</span>}
                </div>
              </div>
            )}
            {s.wind_feel && (
              <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 4 }}>WIND</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{windFeelLabels[s.wind_feel] || s.wind_feel}</div>
              </div>
            )}
          </div>
        )}

        {s.notes && (
          <div style={{ background: C.card, boxShadow: C.cardShadow, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, marginBottom: 6 }}>NOTITIES</div>
            <div style={{ fontSize: 14, color: C.navy, lineHeight: 1.6 }}>{s.notes}</div>
          </div>
        )}

        {/* Deel knoppen */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 12 }}>
          <button onClick={handleShare} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px", background: "#2E8FAE", border: "none", borderRadius: 12,
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Deel sessie
          </button>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px", background: "#25D366", borderRadius: 12,
            color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
        </div>

        {showCrop && (s.photo_url || s.image_url) && (
          <PhotoCropModal
            imageUrl={s.photo_url || s.image_url || ""}
            initialPosition={s.photo_crop ?? undefined}
            onConfirm={saveCrop}
            onCancel={() => setShowCrop(false)}
          />
        )}

        <div style={{ marginTop: 8, textAlign: "center" }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#8A9BB0", fontWeight: 500 }}>🗑 Verwijder sessie</button>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 16px", background: "#F6F1EB", border: "1px solid #E2D9CE", borderRadius: 10, color: "#1F354C", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuleer</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", background: "#C97A63", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{deleting ? "Verwijderen..." : "Ja, verwijder"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MijnSessiesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    (async () => {
      if (isTokenExpired()) { window.location.href = "/login"; return; }
      const authId = getAuthId();
      if (!authId) return;
      try {
        const token = await getValidToken();
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=id`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const users = await userRes.json();
        if (!users?.length) return;
        const userId = users[0].id;

        const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?created_by=eq.${userId}&status=eq.completed&order=id.desc&select=id,spot_id,session_date,status,rating,gear_type,gear_size,forecast_wind,forecast_dir,wind_feel,notes,photo_url,photo_crop,image_url`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        const data: Session[] = await res.json() || [];

        if (data.length > 0) {
          const spotIds = [...new Set(data.map(s => s.spot_id))];
          const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots?id=in.(${spotIds.join(",")})&select=id,display_name`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          });
          const spotData = await spotRes.json();
          const spotMap: Record<number, string> = {};
          (spotData || []).forEach((s: any) => { spotMap[s.id] = s.display_name; });
          data.forEach(s => { s._spotName = spotMap[s.spot_id] || "Spot"; });
        }

        setSessions(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: "50%", background: C.card, border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <span style={{ ...h, fontSize: 22, fontWeight: 800, color: C.navy }}>Mijn sessies</span>
          {!loading && sessions.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginLeft: "auto", background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 8, padding: "3px 9px" }}>{sessions.length}</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13, color: C.muted }}>Laden...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Nog geen sessies</div>
            <div style={{ fontSize: 12, color: C.muted }}>Log je eerste sessie via de feed.</div>
          </div>
        ) : (
          sessions.map(s => (
            <SessionCard key={s.id} s={s} onClick={() => setSelected(s)} />
          ))
        )}
      </div>
      {selected && <SessionDetail s={selected} onClose={() => setSelected(null)} />}
      <NavBar />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}