// A weight curve as an SVG path: time across, kg up.

const PAD = 8;
const round = (n: number) => Math.round(n * 10) / 10;

/** The SVG path through `points` (sorted by time here), scaled into width × height with a padding. */
export function weightPath(points: readonly { at: number; kg: number }[], width: number, height: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${round(width / 2)},${round(height / 2)}h0`;
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const [t0, t1] = [sorted[0].at, sorted.at(-1)!.at];
  const kgs = sorted.map((p) => p.kg);
  const [lo, hi] = [Math.min(...kgs), Math.max(...kgs)];
  const x = (at: number) => (t1 === t0 ? width / 2 : PAD + ((at - t0) / (t1 - t0)) * (width - 2 * PAD));
  const y = (kg: number) => (hi === lo ? height / 2 : height - PAD - ((kg - lo) / (hi - lo)) * (height - 2 * PAD));
  return sorted.map((p, i) => `${i ? "L" : "M"}${round(x(p.at))},${round(y(p.kg))}`).join("");
}
