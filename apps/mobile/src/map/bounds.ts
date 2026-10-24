// The box around a walk's routes for the native map's camera: corners as [lon, lat] (MapLibre's order; the routes
// come as [lat, lon]), null without a single point. One point gives one corner twice; the map centers on it.
export function routeBounds(routes: [number, number][][]): { ne: [number, number]; sw: [number, number] } | null {
  const points = routes.flat();
  if (points.length === 0) return null;
  const lats = points.map(([lat]) => lat);
  const lons = points.map(([, lon]) => lon);
  return { ne: [Math.max(...lons), Math.max(...lats)], sw: [Math.min(...lons), Math.min(...lats)] };
}
