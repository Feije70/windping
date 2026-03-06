"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors as C, fonts } from "@/lib/design";
import { getValidToken, isTokenExpired, getAuthId, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
const h = { fontFamily: fonts.heading };

export default function SpotCreatePage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isTokenExpired()) { window.location.href = "/login"; return; }

    // Load Google Maps
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDummyKeyReplaceThis&callback=initMap`;
    script.async = true;
    (window as any).initMap = () => {
      navigator.geolocation?.getCurrentPosition(
        pos => initializeMap(pos.coords.latitude, pos.coords.longitude),
        () => initializeMap(52.3, 4.9), // Default: Nederland
        { timeout: 5000 }
      );
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  function initializeMap(centerLat: number, centerLng: number) {
    if (!mapRef.current) return;
    const googleMap = new (window as any).google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const googleMarker = new (window as any).google.maps.Marker({
      map: googleMap,
      draggable: true,
      visible: false,
    });

    googleMap.addListener("click", (e: any) => {
      const clickLat = e.latLng.lat();
      const clickLng = e.latLng.lng();
      googleMarker.setPosition(e.latLng);
      googleMarker.setVisible(true);
      setLat(clickLat);
      setLng(clickLng);
    });

    googleMarker.addListener("dragend", (e: any) => {
      setLat(e.latLng.lat());
      setLng(e.latLng.lng());
    });

    setMap(googleMap);
    setMarker(googleMarker);
  }

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

      // Spot aanmaken
      const spotRes = await fetch(`${SUPABASE_URL}/rest/v1/spots`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ display_name: name.trim(), latitude: lat, longitude: lng }),
      });
      const spotData = await spotRes.json();
      const newSpot = Array.isArray(spotData) ? spotData[0] : spotData;

      // Toevoegen aan user_spots
      await fetch(`${SUPABASE_URL}/rest/v1/user_spots`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, spot_id: newSpot.id }),
      });

      // Terug naar spot-select met nieuwe spot geselecteerd
      localStorage.setItem("session_spot_id", String(newSpot.id));
      localStorage.setItem("session_spot_name", newSpot.display_name);
      router.back();
      router.back();
    } catch (e) {
      console.error(e);
      setError("Er ging iets mis. Probeer opnieuw.");
    }
    setSaving(false);
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>

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
            <span style={{ ...h, fontSize: 20, fontWeight: 800, color: C.navy }}>Nieuwe spot</span>
          </div>
        </div>

        {/* Kaart */}
        <div ref={mapRef} style={{ flex: 1, minHeight: 320, background: C.cardBorder }} />

        {/* Instructie */}
        {!lat && (
          <div style={{ padding: "12px 16px", background: `${C.sky}15`, borderTop: `1px solid ${C.sky}30` }}>
            <div style={{ fontSize: 13, color: C.sky, fontWeight: 600, textAlign: "center" }}>
              Tik op de kaart om je spot te markeren
            </div>
          </div>
        )}

        {/* Naam invoer + opslaan */}
        <div style={{ padding: "16px", borderTop: `1px solid ${C.cardBorder}` }}>
          {lat && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, textAlign: "center" }}>
              📍 {lat.toFixed(4)}, {lng?.toFixed(4)}
            </div>
          )}
          <input
            type="text"
            placeholder="Naam van de spot..."
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", background: C.card,
              border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, fontSize: 14,
              color: C.navy, outline: "none", marginBottom: 12, boxSizing: "border-box",
            }}
          />
          {error && <div style={{ fontSize: 12, color: "#C97A63", marginBottom: 10 }}>{error}</div>}
          <button onClick={saveSpot} disabled={saving || !lat || !name.trim()} style={{
            width: "100%", padding: "14px", background: (saving || !lat || !name.trim()) ? C.cardBorder : C.sky,
            color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: (saving || !lat || !name.trim()) ? "not-allowed" : "pointer",
          }}>
            {saving ? "Opslaan..." : "Spot opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
