// The native map comes with the Android app (step 3); until then a native build shows no map. Same props as
// TrackMap.web.tsx.
export type TrackMapProps = { routes: [number, number][][]; height: number | { min: number }; still?: boolean };

export function TrackMap(props: TrackMapProps) {
  void props;
  return null;
}
