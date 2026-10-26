// Routes on an OpenStreetMap map (Leaflet), fitted to them: the walk summary's big map, Verlauf's thumbnails and the
// week's routes. `height` is a number, or `{ min }` for a map that takes the height left on its screen (Woche), at
// least `min`; it fits the routes again when its size changes. A map that isn't `still` has a button in its corner
// that shows it on the whole screen, until the button there or Escape makes it small again. Each route is a list of [lat, lon]. Not draggable when `still` (a thumbnail in a list),
// and then without the attribution line, which would cover the whole thumbnail (the big maps carry it).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../theme";
import { Corner } from "./Corner";

export type TrackMapProps = { routes: [number, number][][]; height: number | { min: number }; still?: boolean };

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function TrackMap({ routes, height, still = false }: TrackMapProps) {
  const theme = useTheme();
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setBig(false);
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [big]);
  const size = typeof height === "number" ? { height } : { flex: 1, minHeight: height.min };
  // dragged itself: no swipe from it (useSwipe)
  return (
    <div data-noswipe style={{ ...size, position: "relative", width: "100%" }}>
      <MapBox routes={routes} still={still} />
      {still ? null : <Corner icon="expand" label="Karte vergrößern" onPress={() => setBig(true)} />}
      {big
        ? createPortal(
            <div data-testid="track-map-big" data-noswipe style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)", background: theme.background }}>
              <div style={{ position: "relative", flex: 1 }}>
                <MapBox routes={routes} still={false} />
                <Corner icon="shrink" label="Karte verkleinern" onPress={() => setBig(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// a still map (Verlauf's) keeps a thin margin and a thin line, so the walk fills it instead of the city around it
function fit(map: L.Map, lines: L.Polyline[], still: boolean) {
  const pad = still ? 10 : 16;
  if (lines.length) map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [pad, pad], maxZoom: 17 });
}

/** The map itself, filling what holds it. The map stays while its routes change (a walk's grows each second, and its
 * screen hands a new list at every tick): only the lines are drawn anew, so the tiles don't reload and flicker (#139). */
function MapBox({ routes, still }: { routes: [number, number][][]; still: boolean }) {
  const theme = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lines = useRef<L.Polyline[]>([]);
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomSnap: still ? 0.25 : 1, zoomControl: !still, dragging: !still, scrollWheelZoom: false, touchZoom: !still, doubleClickZoom: !still, keyboard: !still, boxZoom: !still, attributionControl: !still });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
    map.current = m;
    const resized = new ResizeObserver(() => {
      m.invalidateSize();
      fit(m, lines.current, still);
    });
    resized.observe(box.current);
    return () => {
      resized.disconnect();
      m.remove();
      map.current = null;
      lines.current = [];
    };
  }, [still]);
  // the routes by what they hold, not by the list they come in
  const drawn = JSON.stringify(routes.filter((r) => r.length > 0));
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const l of lines.current) l.remove();
    lines.current = (JSON.parse(drawn) as [number, number][][]).map((r) => L.polyline(r, { color: theme.walk, weight: still ? 3 : 4, interactive: false }).addTo(m));
    fit(m, lines.current, still);
  }, [drawn, still, theme.walk]);
  return <div ref={box} data-testid="track-map" style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden", background: theme.surface }} />;
}
