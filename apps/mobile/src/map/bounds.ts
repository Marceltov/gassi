// The box around a walk's routes for the native map's camera: corners as [lon, lat] (MapLibre's order; the routes
// come as [lat, lon]), null without a single point. One point gives one corner twice; the map centers on it.
export function routeBounds(routes: [number, number][][]): { ne: [number, number]; sw: [number, number] } | null {
  const points = routes.flat();
  if (points.length === 0) return null;
  // a loop, not Math.max(...): a long walk has more points than a call takes arguments
  const ne: [number, number] = [-Infinity, -Infinity];
  const sw: [number, number] = [Infinity, Infinity];
  for (const [lat, lon] of points) {
    ne[0] = Math.max(ne[0], lon);
    ne[1] = Math.max(ne[1], lat);
    sw[0] = Math.min(sw[0], lon);
    sw[1] = Math.min(sw[1], lat);
  }
  return { ne, sw };
}
