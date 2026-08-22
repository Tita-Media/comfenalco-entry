"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type GeoEntry = { lat: number; lng: number; label: string; time: string };

export default function EntriesMap({ points }: { points: GeoEntry[] }) {
  if (points.length === 0) {
    return <p className="muted">No hay ingresos con geolocalización todavía.</p>;
  }

  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  return (
    <div style={{ height: 380, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={7}
            pathOptions={{ color: "#005744", fillColor: "#58b250", fillOpacity: 0.7, weight: 2 }}
          >
            <Tooltip>
              {p.label} · {p.time}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
