"use client";

import { useEffect, useRef, useCallback } from "react";
import { colors as C } from "@/lib/design";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const typeColors: Record<string, string> = { Zee: "#2E8FAE", Meer: "#3EAA8C", Rivier: "#E8A83E" };

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

interface SpotsMapProps {
  spots: Spot[];
  onBoundsChange: (ids: Set<number>) => void;
}

export default function SpotsMap({ spots, onBoundsChange }: SpotsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const filterByBounds = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    const ids = new Set<number>();
    markersRef.current.forEach((m: any) => {
      if (bounds.contains(m.getLatLng())) ids.add(m._spotId);
    });
    onBoundsChange(ids);
  }, [onBoundsChange]);

  // Map initialiseren
  useEffect(() => {
    if (!mapElRef.current) return;

    const map = L.map(mapElRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    }).setView([52.3, 5.0], 7);

    L.control.attribution({ prefix: false, position: "bottomright" })
      .addAttribution('<a href="https://leafletjs.com" style="font-size:9px;opacity:0.5;">Leaflet</a> · © OSM')
      .addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(map);

    mapRef.current = map;
    map.on("moveend zoomend", filterByBounds);

    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d) => { if (d.latitude && d.longitude) map.setView([d.latitude, d.longitude], 7); })
      .catch(() => {});

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [filterByBounds]);

  // Markers plaatsen
  useEffect(() => {
    if (!mapRef.current || !spots.length) return;
    const map = mapRef.current;

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
  }, [spots, filterByBounds]);

  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const icon = L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25);"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        L.marker([latitude, longitude], { icon })
          .addTo(mapRef.current!)
          .bindTooltip("Your location", { direction: "top", offset: [0, -10] });
        mapRef.current!.setView([latitude, longitude], 8);
      },
      () => {},
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <>
      <div ref={mapElRef} style={{ width: "100%", height: 400, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.cardBorder}`, marginBottom: 12 }} />
      <style>{`
        .leaflet-control-zoom a { background: #fff !important; color: #333 !important; border-color: #ccc !important; }
        .leaflet-popup-content-wrapper { background: #fff !important; color: #333 !important; border-radius: 12px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important; }
        .leaflet-popup-tip { background: #fff !important; }
        .leaflet-tooltip { background: #fff !important; color: #333 !important; border: 1px solid #ddd !important; border-radius: 8px !important; font-size: 12px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important; }
        .leaflet-tooltip-top::before { border-top-color: #fff !important; }
        .leaflet-control-attribution { background: transparent !important; font-size: 9px !important; opacity: 0.4 !important; }
        .leaflet-control-attribution a { color: inherit !important; }
      `}</style>
      <button onClick={handleLocate} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
        padding: "13px 16px", background: `linear-gradient(135deg, ${C.sky}, #4DB8C9)`, border: "none", borderRadius: 12,
        fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 2px 10px ${C.sky}50`, marginBottom: 12,
      }}>
        📍 Zoom to my location
      </button>
    </>
  );
}
