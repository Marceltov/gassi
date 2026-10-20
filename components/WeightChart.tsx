// Toffee's weight over time as a line: time across, kg up. Pure SVG, drawn on the server.
import { formatKg } from "./entryStyle";

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

export function WeightChart({ points }: { points: { at: number; kg: number }[] }) {
  if (points.length === 0) return null;
  const kgs = points.map((p) => p.kg);
  return (
    <figure className="rounded-3xl border border-line bg-surface p-4">
      <svg viewBox="0 0 320 160" className="h-auto w-full" role="img" aria-label={`Gewichtsverlauf von ${formatKg(Math.min(...kgs) * 1000)} bis ${formatKg(Math.max(...kgs) * 1000)}`}>
        <path d={weightPath(points, 320, 160)} fill="none" stroke="var(--primary)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-sm text-muted">
        <span>min. {formatKg(Math.min(...kgs) * 1000)}</span>
        <span>max. {formatKg(Math.max(...kgs) * 1000)}</span>
      </figcaption>
    </figure>
  );
}
