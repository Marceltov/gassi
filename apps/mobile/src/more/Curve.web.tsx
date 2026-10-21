// A weight curve on the web: the domain's SVG path (time across, kg up) in an <svg> as wide as the screen. The line
// keeps its width however the box is stretched; one weight is a dot.
import { weightPath } from "@gassi/domain";
import { useTheme } from "../theme";

export type CurveProps = { points: { at: number; kg: number }[]; height: number };

const WIDTH = 320;

export function Curve({ points, height }: CurveProps) {
  const theme = useTheme();
  return (
    <svg data-testid="weight-curve" role="img" aria-label="Gewichtskurve" viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block", background: theme.surface, borderRadius: 12 }}>
      <path d={weightPath(points, WIDTH, height)} fill="none" stroke={theme.walk} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
