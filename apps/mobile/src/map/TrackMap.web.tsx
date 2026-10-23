// Routes on an OpenStreetMap map (Leaflet), fitted to them: the walk summary's big map, Verlauf's thumbnails and the
// week's routes. `height` is a number, or `{ min }` for a map that takes the height left on its screen (Woche), at
// least `min`; it fits the routes again when its size changes. Each route is a list of [lat, lon]. Not draggable when `still` (a thumbnail in a list),
// and then without the attribution line, which would cover the whole thumbnail (the big maps carry it).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme";

export type TrackMapProps = { routes: [number, number][][]; height: number | { min: number }; still?: boolean };

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function TrackMap({ routes, height, still = false }: TrackMapProps) {
  const theme = useTheme();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const drawn = routes.filter((r) => r.length > 0);
    if (!box.current || drawn.length === 0) return;
    const map = L.map(box.current, { zoomControl: !still, dragging: !still, scrollWheelZoom: false, touchZoom: !still, doubleClickZoom: !still, keyboard: !still, boxZoom: !still, attributionControl: !still });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    const lines = drawn.map((r) => L.polyline(r, { color: theme.walk, weight: 4 }).addTo(map));
    const fit = () => map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [16, 16], maxZoom: 17 });
    fit();
    const resized = new ResizeObserver(() => {
      map.invalidateSize();
      fit();
    });
    resized.observe(box.current);
    return () => {
      resized.disconnect();
      map.remove();
    };
  }, [routes, still, theme.walk]);
  const size = typeof height === "number" ? { height } : { flex: 1, minHeight: height.min };
  // dragged itself: no swipe from it (useSwipe)
  return <div ref={box} data-testid="track-map" data-noswipe style={{ ...size, width: "100%", borderRadius: 12, overflow: "hidden", background: theme.surface }} />;
}
