// Routes on an OpenStreetMap map on Android (MapLibre), drawing what TrackMap.web.tsx draws: the same tiles, the
// routes in the walk's colour, the camera fitted to them (one point: centered at street level). `height` is a number,
// or `{ min }` for a map that takes the height left on its screen. A map that isn't `still` has a button in its corner
// that shows it on the whole screen, until the button there or Android's back makes it small again. Each route is a
// list of [lat, lon]. Not movable when `still` (a thumbnail in a list), and then without the attribution.
import { Camera, Map } from "@maplibre/maplibre-react-native";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import { useEdges } from "../ui/edges";
import { routeBounds } from "./bounds";
import { Corner } from "./Corner";

export type TrackMapProps = { routes: [number, number][][]; height: number | { min: number }; still?: boolean };

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = "© OpenStreetMap";

export function TrackMap({ routes, height, still = false }: TrackMapProps) {
  const theme = useTheme();
  const edges = useEdges();
  const [big, setBig] = useState(false);
  const size = typeof height === "number" ? { height } : { flex: 1, minHeight: height.min };
  return (
    <View style={[size, styles.box]}>
      <MapBox routes={routes} still={still} />
      {still ? null : <Corner icon="expand" label="Karte vergrößern" onPress={() => setBig(true)} />}
      <Modal visible={big} animationType="fade" onRequestClose={() => setBig(false)}>
        <View testID="track-map-big" style={[styles.big, { backgroundColor: theme.background, paddingBottom: edges.bottom(), paddingLeft: edges.left(), paddingRight: edges.right() }]}>
          <MapBox routes={routes} still={false} />
          <Corner icon="shrink" label="Karte verkleinern" onPress={() => setBig(false)} />
        </View>
      </Modal>
    </View>
  );
}

/** The map itself, filling what holds it. */
function MapBox({ routes, still }: { routes: [number, number][][]; still: boolean }) {
  const theme = useTheme();
  const bounds = useMemo(() => routeBounds(routes), [routes]);
  const mapStyle = useMemo<StyleSpecification>(
    () => ({
      version: 8,
      sources: {
        osm: { type: "raster", tiles: [TILES], tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION },
        routes: {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: routes.filter((r) => r.length > 0).map((r) => r.map(([lat, lon]) => [lon, lat])) } },
        },
      },
      layers: [
        { id: "osm", type: "raster", source: "osm" },
        // a still map (Verlauf's) keeps a thin line, as on the web
        { id: "routes", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": theme.walk, "line-width": still ? 3 : 4 } },
      ],
    }),
    [routes, still, theme.walk],
  );
  const fill = [StyleSheet.absoluteFill, styles.map, { backgroundColor: theme.surface }];
  if (!bounds) return <View testID="track-map" style={fill} />;
  const pad = still ? 10 : 16;
  const one = bounds.ne[0] === bounds.sw[0] && bounds.ne[1] === bounds.sw[1];
  return (
    <View testID="track-map" style={fill}>
      <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle} logo={false} attribution={!still} compass={false} dragPan={!still} touchZoom={!still} doubleTapZoom={!still} doubleTapHoldZoom={!still} touchRotate={false} touchPitch={false}>
        {one ? (
          <Camera center={bounds.ne} zoom={16} duration={0} />
        ) : (
          <Camera bounds={[bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]]} padding={{ top: pad, right: pad, bottom: pad, left: pad }} maxZoom={17} duration={0} />
        )}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "relative", width: "100%" },
  big: { flex: 1 },
  map: { borderRadius: 12, overflow: "hidden" },
});
