// Routes on an OpenStreetMap map (Leaflet), fitted to them: the walk summary's big map now, Verlauf's thumbnails and
// the week's routes later. Each route is a list of [lat, lon]. Not draggable when `still` (a thumbnail in a list).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme";

export type TrackMapProps = { routes: [number, number][][]; height: number; still?: boolean };

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function TrackMap({ routes, height, still = false }: TrackMapProps) {
  const theme = useTheme();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const drawn = routes.filter((r) => r.length > 0);
    if (!box.current || drawn.length === 0) return;
    const map = L.map(box.current, { zoomControl: !still, dragging: !still, scrollWheelZoom: false, touchZoom: !still, doubleClickZoom: !still, attributionControl: true });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    const lines = drawn.map((r) => L.polyline(r, { color: theme.walk, weight: 4 }).addTo(map));
    map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [16, 16], maxZoom: 17 });
    return () => {
      map.remove();
    };
  }, [routes, still, theme.walk]);
  return <div ref={box} data-testid="track-map" style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", background: theme.surface }} />;
}
