// The native weight curve comes with the Android app (step 3, with react-native-svg); until then a native build shows
// none. Same props as Curve.web.tsx.
export type CurveProps = { points: { at: number; kg: number }[] };

export function Curve(props: CurveProps) {
  void props;
  return null;
}
