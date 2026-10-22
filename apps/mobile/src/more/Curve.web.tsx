// A weight curve on the web: the domain's SVG path (time across, kg up) in an <svg> that fills its box. The line keeps
// its width however the box is stretched; one weight is a dot.
import { weightPath } from "@gassi/domain";
import { useTheme } from "../theme";

export type CurveProps = { points: { at: number; kg: number }[] };

// the path's own grid; the box stretches it
const WIDTH = 320;
const HEIGHT = 100;

export function Curve({ points }: CurveProps) {
  const theme = useTheme();
  return (
    <svg data-testid="weight-curve" role="img" aria-label="Gewichtskurve" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", background: theme.surface, borderRadius: 12 }}>
      <path d={weightPath(points, WIDTH, HEIGHT)} fill="none" stroke={theme.walk} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
