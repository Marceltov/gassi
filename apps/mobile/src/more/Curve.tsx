// A weight curve on Android: what Curve.web.tsx draws, with react-native-svg. The domain's SVG path (time across, kg
// up) fills its box; the line keeps its width however the box is stretched, one weight is a dot.
import { weightPath } from "@gassi/domain";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme";

export type CurveProps = { points: { at: number; kg: number }[] };

// the path's own grid; the box stretches it
const WIDTH = 320;
const HEIGHT = 100;

export function Curve({ points }: CurveProps) {
  const theme = useTheme();
  return (
    <Svg testID="weight-curve" accessibilityLabel="Gewichtskurve" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" width="100%" height="100%" style={{ backgroundColor: theme.surface, borderRadius: 12 }}>
      <Path d={weightPath(points, WIDTH, HEIGHT)} fill="none" stroke={theme.walk} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}
