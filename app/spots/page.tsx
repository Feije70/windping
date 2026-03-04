"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { colors as C, fonts } from "@/lib/design";
import NavBar from "@/components/NavBar";
import { Icons } from "@/components/Icons";
import { getValidToken, getEmail, isTokenExpired, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const h = { fontFamily: fonts.heading };

interface Spot {
  id: number;
  display_name: string;
  latitude: number;
  longitude: number;
  spot_type: string | null;
  level: string | null;
  min_wind: number | null;
  max_wind: number | null;
  good_directions: string[] | null;
  tips: string | null;
}

const typeColors: Record<string, string> = { Zee: "#2E8FAE", Meer: "#3EAA8C", Rivier: "#E8A83E" };

function SpotCard({ spot }: { spot: Spot }) {
  const dirs = spot.good_directions?.join(", ") || "—";
  const typeColor = typeColors[spot.spot_type || ""] || C.sky;

  return (
    <a href={`/spot?id=${spot.id}`} style={{
      display: "block", background: C.card, borderRadius: 14, boxShadow: C.cardShadow,
      padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", textDecoration: "none", color: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{spot.display_name}</span>
        {spot.spot_type && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${typeColor}20`, color: typeColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {spot.spot_type}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
        {spot.level && <span>Level: {spot.level}</span>}
        <span>Wind: {spot.min_wind || "?"}-{spot.max_wind || "?"} kn</span>
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Direction: {dirs}</div>
    </a>
  );
}

export default function SpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());

  // Load spots from Supabase
  useEffect(() => {
    async function load() {
      try {
        const token = await getValidToken();
        const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?active=eq.true&is_private=eq.false&select=id,display_name,latitude,longitude,spot_type,level,min_wind,max_wind,good_directions,tips&order=display_name`, {
          headers,
        });
        const data = await res.json();
        setSpots(data || []);
      } catch (e) { console.warn("Spots load error:", e); }
      setLoading(false);
    }
    load();
  }, []);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load JS
    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => { LRef.current = (window as any).L; setMapReady(true); };
      document.head.appendChild(script);
    } else {
      LRef.current = (window as any).L;
      setMapReady(true);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapReady || !mapElRef.current || mapRef.current || !LRef.current) return;
    const L = LRef.current;

    const map = L.map(mapElRef.current, { zoomControl: true, scrollWheelZoom: true, attributionControl: false }).setView([52.3, 5.0], 7);
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution('<a href="https://leafletjs.com" style="font-size:9px;opacity:0.5;">Leaflet</a> · © OSM').addTo(map);

    // Light tile layer (Google Maps style)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    map.on("moveend zoomend", filterByBounds);

    // IP-based geolocation on load (no permission needed)
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d) => { if (d.latitude && d.longitude) map.setView([d.latitude, d.longitude], 7); })
      .catch(() => {});
  }, [mapReady]);

  // Add markers when spots load
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !spots.length) return;
    const L = LRef.current;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    spots.forEach((spot) => {
      if (!spot.latitude || !spot.longitude) return;
      const color = typeColors[spot.spot_type || ""] || C.sky;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -8],
      });

      const dirs = spot.good_directions?.join(", ") || "—";
      const popup = `<div style="font-family:system-ui;font-size:13px;">
        <strong>${spot.display_name}</strong><br/>
        <span style="font-size:11px;color:#666;">${spot.spot_type || ""} · ${spot.level || ""}</span><br/>
        <span style="font-size:11px;">Wind: ${spot.min_wind || "?"}-${spot.max_wind || "?"} kn · ${dirs}</span><br/>
        <a href="/spot?id=${spot.id}" style="display:block;margin-top:8px;padding:7px 0;background:linear-gradient(135deg,#2E8FAE,#4DB8C9);color:white;font-weight:700;font-size:12px;text-decoration:none;text-align:center;border-radius:8px;">View spot →</a>
      </div>`;

      const marker = L.marker([spot.latitude, spot.longitude], { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 220 })
        .bindTooltip(spot.display_name, { direction: "top", offset: [0, -8] });

      (marker as any)._spotId = spot.id;
      markersRef.current.push(marker);
    });

    if (markersRef.current.length) {
      map.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.1));
    }
    filterByBounds();
  }, [spots, mapReady]);

  const filterByBounds = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    const ids = new Set<number>();
    markersRef.current.forEach((m: any) => {
      if (bounds.contains(m.getLatLng())) ids.add(m._spotId);
    });
    setVisibleIds(ids);
  }, []);

  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current || !LRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const L = LRef.current;
        const { latitude, longitude } = pos.coords;
        const icon = L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25);"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        L.marker([latitude, longitude], { icon }).addTo(mapRef.current).bindTooltip("Your location", { direction: "top", offset: [0, -10] });
        mapRef.current.setView([latitude, longitude], 8);
      },
      () => { /* silently fail */ },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  // Filter spots by search + map bounds
  const filtered = spots.filter((s) => {
    if (!visibleIds.has(s.id) && visibleIds.size > 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.display_name.toLowerCase().includes(q)
      || (s.spot_type || "").toLowerCase().includes(q)
      || (s.level || "").toLowerCase().includes(q)
      || (s.good_directions || []).join(" ").toLowerCase().includes(q);
  });

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.navy }}>
      <NavBar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>
        <h1 className="font-bebas" style={{ ...h, fontSize: 28, letterSpacing: 2, color: C.navy, margin: "0 0 16px" }}>Spots</h1>

        {/* Map */}
        <div ref={mapElRef} style={{ width: "100%", height: 400, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.cardBorder}`, marginBottom: 12 }} />

        {/* Locate button */}
        <button onClick={handleLocate} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "13px 16px", background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 2px 10px ${C.sky}50`, marginBottom: 12,
        }}>
          {Icons.mapPin({ color: "#fff", size: 18 })} Zoom to my location
        </button>

        {/* Search */}
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search spots..."
          style={{
            width: "100%", padding: "12px 16px", background: C.card, border: `1.5px solid ${C.cardBorder}`,
            borderRadius: 12, fontSize: 14, color: C.navy, outline: "none", marginBottom: 8, boxSizing: "border-box",
          }}
        />

        {/* Counter */}
        <div style={{ fontSize: 12, color: C.sub, padding: "4px 0 12px 2px" }}>
          {filtered.length} of {spots.length} spots{search ? ` (search: "${search}")` : ""}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${C.cardBorder}`, borderTopColor: C.sky, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          </div>
        )}

        {/* Spot cards */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 20px", color: C.muted, fontSize: 14 }}>
            No spots found. Zoom out or change your search.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-control-zoom a { background: #fff !important; color: #333 !important; border-color: #ccc !important; }
        .leaflet-popup-content-wrapper { background: #fff !important; color: #333 !important; border-radius: 12px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important; }
        .leaflet-popup-tip { background: #fff !important; }
        .leaflet-tooltip { background: #fff !important; color: #333 !important; border: 1px solid #ddd !important; border-radius: 8px !important; font-size: 12px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important; }
        .leaflet-tooltip-top::before { border-top-color: #fff !important; }
        .leaflet-control-attribution { background: transparent !important; font-size: 9px !important; opacity: 0.4 !important; }
        .leaflet-control-attribution a { color: inherit !important; }
      `}</style>
    </div>
  );
}