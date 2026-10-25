// A walk's routes as GeoJSON for the native map (MapLibre, [lon, lat]): a route as a line, a route of one position as a
// point (a line of one position draws nothing), an empty route left out.
type Geometry = { type: "LineString"; coordinates: [number, number][] } | { type: "Point"; coordinates: [number, number] };
type Shapes = { type: "FeatureCollection"; features: { type: "Feature"; properties: object; geometry: Geometry }[] };

export function routeShapes(routes: [number, number][][]): Shapes {
  const features = routes
    .filter((r) => r.length > 0)
    .map((r) => {
      const coordinates = r.map(([lat, lon]): [number, number] => [lon, lat]);
      const geometry: Geometry = coordinates.length === 1 ? { type: "Point", coordinates: coordinates[0]! } : { type: "LineString", coordinates };
      return { type: "Feature" as const, properties: {}, geometry };
    });
  return { type: "FeatureCollection", features };
}
