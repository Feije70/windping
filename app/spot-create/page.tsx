"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, isTokenExpired, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

export default function SpotCreatePage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (isTokenExpired()) { window.location.href = "/login"; return; }
    if (mapInstanceRef.current) return;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    function initMap(centerLat: number, centerLng: number) {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      // Fix voor Leaflet icon path in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([centerLat, centerLng], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", (ev: any) => {
            setLat(ev.target.getLatLng().lat);
            setLng(ev.target.getLatLng().lng);
          });
        }
        setLat(clickLat);
        setLng(clickLng);
      });

      mapInstanceRef.current = map;
      setMapReady(true);

      // Fix kaart grootte na render
      setTimeout(() => map.invalidateSize(), 100);
    }

    // Load Leaflet JS
    if ((window as any).L) {
      navigator.geolocation?.getCurrentPosition(
        pos => initMap(pos.coords.latitude, pos.coords.longitude),
        () => initMap(52.3, 4.9),
        { timeout: 5000 }
      );
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        navigator.geolocation?.getCurrentPosition(
          pos => initMap(pos.coords.latitude, pos.coords.longitude),
          () => initMap(52.3, 4.9),
          { timeout: 5000 }
        );
      };
      document.head.appendChild(script);
    }
  }, []);

  async function saveSpot() {
    if (!lat || !lng || !name.trim()) { setError("Kies een locatie op de kaart en geef een naam op."); return; }
    setSaving(true);
    setError("");
    try {
      const token = await getValidToken();
      const authId = getAuthId();
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId || "")}&select=id`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      const users = await userRes.json();
      if (!users?.length) throw new Error("User not found");
      const userId = users[0].id;

      const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ display_name: name.trim(), latitude: lat, longitude: lng }),
      });
      const spotData = await spotRes.json();
      const newSpot = Array.isArray(spotData) ? spotData[0] : spotData;

      await fetch(`${SUPABASE_URL}/rest/v1/user_spots`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, spot_id: newSpot.id }),
      });

      localStorage.setItem("session_spot_id", String(newSpot.id));
      localStorage.setItem("session_spot_name", newSpot.display_name);
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      setError("Er ging iets mis. Probeer opnieuw.");
    }
    setSaving(false);
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.cardBorder}`, background: C.cream }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.back()} style={{
              width: 36, height: 36, borderRadius: "50%", background: C.card,
              border: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div>
              <span style={{ ...h, fontSize: 20, fontWeight: 800, color: C.navy }}>Nieuwe spot</span>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Tik op de kaart om je spot te markeren</div>
            </div>
          </div>
        </div>

        {/* Naam invoer bovenaan */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, background: C.cream }}>
          <input
            type="text"
            placeholder="Naam van de spot..."
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", background: C.card,
              border: `1.5px solid ${name ? C.sky : C.cardBorder}`, borderRadius: 12, fontSize: 14,
              color: C.navy, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Kaart */}
        <div ref={mapRef} style={{ flex: 1, minHeight: 400 }} />

        {/* Instructie + opslaan onderin */}
        <div style={{ padding: "12px 16px 32px", borderTop: `1px solid ${C.cardBorder}`, background: C.cream }}>
          {!lat && (
            <div style={{ fontSize: 13, color: C.sky, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>
              👆 Tik op de kaart om een locatie te kiezen
            </div>
          )}
          {lat && (
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginBottom: 10 }}>
              📍 {lat.toFixed(5)}, {lng?.toFixed(5)}
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: "#C97A63", marginBottom: 10, textAlign: "center" }}>{error}</div>}
          <button onClick={saveSpot} disabled={saving || !lat || !name.trim()} style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
            border: "none", cursor: (saving || !lat || !name.trim()) ? "not-allowed" : "pointer",
            background: (saving || !lat || !name.trim()) ? C.cardBorder : C.sky,
            color: (saving || !lat || !name.trim()) ? C.muted : "#fff",
          }}>
            {saving ? "Opslaan..." : "Spot opslaan →"}
          </button>
        </div>
      </div>
    </div>
  );
}
