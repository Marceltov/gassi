// The route as it was walked, from the raw GPS points a phone sent (#104): bad points out, the rest smoothed by how
// precise each one is, and standing still adds nothing. The server runs it over a whole walk (forward and back, so the
// line has no lag); the recording phone runs it forward for the live distance. Raw points stay stored, so a better
// filter later improves old walks too.
//
// 1. Gates: a point without accuracy or worse than MAX_ACC_M, or one that would mean faster than MAX_MPS from the last
//    kept point, is dropped.
// 2. Kalman filter, constant velocity, east and north apart (they don't mix: the noise is round, the motion
//    independent): a point counts by its accuracy, and the time since the last point widens the uncertainty, so gaps
//    are handled. A point too far from the prediction for its accuracy is dropped as well (multipath near buildings).
//    After MAX_REJECTS dropped points in a row, the filter starts over at the next one: it was the earlier ones that
//    were off.
// 3. The server smooths backwards (Rauch-Tung-Striebel); then a point is kept only while moving (STILL_MPS) and once
//    it is MIN_STEP_M (or its own uncertainty) away from the last kept one, so the wobble while standing adds no
//    distance.
import { type TrackPoint } from "./track";

const MAX_ACC_M = 30;
const MAX_MPS = 7; // 25 km/h: jogging with the dog still counts
const GATE = 9.21; // chi-square, 2 degrees of freedom, 99 %
const ACCEL = 0.01; // process noise: white acceleration, (m/s²)²; a walk changes speed gently
const MIN_STEP_M = 5;
const LIVE_STEP_M = 10; // forward only, the line wobbles more: a longer step keeps the wobble out of the distance
const STILL_MPS = 0.5; // slower than this (by the filter's speed) is standing: sniffing, waiting, a café
const MAX_REJECTS = 5;
const START_SPEED_SD = 2; // m/s, the walk's first speed is unknown

const M_PER_DEG = 111_195;
const rad = (deg: number) => (deg * Math.PI) / 180;

// One axis: position and velocity with their covariance [pp, pv, vv].
type Axis = { p: number; v: number; P: [number, number, number] };
type Step = { t: number; x: Axis; y: Axis; xPred: Axis; yPred: Axis; dt: number; source: TrackPoint };

function predict(a: Axis, dt: number): Axis {
  const [pp, pv, vv] = a.P;
  const q = ACCEL;
  return {
    p: a.p + a.v * dt,
    v: a.v,
    P: [pp + 2 * dt * pv + dt * dt * vv + (q * dt ** 3) / 3, pv + dt * vv + (q * dt ** 2) / 2, vv + q * dt],
  };
}

function update(a: Axis, z: number, r: number): Axis {
  const [pp, pv, vv] = a.P;
  const s = pp + r;
  const [kp, kv] = [pp / s, pv / s];
  const nu = z - a.p;
  return { p: a.p + kp * nu, v: a.v + kv * nu, P: [(1 - kp) * pp, (1 - kp) * pv, vv - kv * pv] };
}

// Rauch-Tung-Striebel: the filtered state `f` corrected by the smoothed next state `next` (predicted as `pred`).
function smooth(f: Axis, pred: Axis, next: Axis, dt: number): Axis {
  const [pp, pv, vv] = f.P;
  // C = P Fᵀ Pred⁻¹, with F = [[1, dt], [0, 1]]
  const [a, b, c] = pred.P;
  const det = a * c - b * b;
  const [i11, i12, i22] = [c / det, -b / det, a / det];
  const [m11, m12, m21, m22] = [pp + dt * pv, pv, pv + dt * vv, vv]; // P Fᵀ
  const C = [m11 * i11 + m12 * i12, m11 * i12 + m12 * i22, m21 * i11 + m22 * i12, m21 * i12 + m22 * i22];
  const [dp, dv] = [next.p - pred.p, next.v - pred.v];
  const [d11, d12, d22] = [next.P[0] - a, next.P[1] - b, next.P[2] - c];
  // P + C D Cᵀ
  const cd11 = C[0] * d11 + C[1] * d12;
  const cd12 = C[0] * d12 + C[1] * d22;
  const cd21 = C[2] * d11 + C[3] * d12;
  const cd22 = C[2] * d12 + C[3] * d22;
  return {
    p: f.p + C[0] * dp + C[1] * dv,
    v: f.v + C[2] * dp + C[3] * dv,
    P: [pp + cd11 * C[0] + cd12 * C[1], pv + cd11 * C[2] + cd12 * C[3], vv + cd21 * C[2] + cd22 * C[3]],
  };
}

// A local flat frame in metres around the first point; good enough at a walk's scale.
function frame(origin: TrackPoint) {
  const mPerLon = M_PER_DEG * Math.cos(rad(origin.lat));
  return {
    toXY: (p: TrackPoint) => [(p.lon - origin.lon) * mPerLon, (p.lat - origin.lat) * M_PER_DEG] as const,
    toPoint: (s: TrackPoint, x: Axis, y: Axis): TrackPoint => ({
      t: s.t,
      lat: origin.lat + y.p / M_PER_DEG,
      lon: origin.lon + x.p / mPerLon,
      ele: s.ele,
      acc: Math.round(Math.sqrt(Math.max(x.P[0], y.P[0])) * 10) / 10,
    }),
  };
}

const usable = (p: TrackPoint) => p.acc !== null && p.acc <= MAX_ACC_M;

// The forward filter, one point at a time; `add` returns the step when the point was kept, `restart` true when the
// filter started over at it.
function forward() {
  let f: ReturnType<typeof frame> | null = null;
  let last: { t: number; x: number; y: number; X: Axis; Y: Axis } | null = null;
  let rejects = 0;
  let seen = 0;
  return {
    toPoint: (s: TrackPoint, x: Axis, y: Axis) => f!.toPoint(s, x, y),
    add(point: TrackPoint): (Step & { restart: boolean }) | null {
      if (!usable(point)) return null;
      f ??= frame(point);
      const t = Date.parse(point.t) / 1000;
      const [zx, zy] = f.toXY(point);
      const r = point.acc! ** 2;
      const start = (): Step & { restart: boolean } => {
        const X: Axis = { p: zx, v: 0, P: [r, 0, START_SPEED_SD ** 2] };
        const Y: Axis = { p: zy, v: 0, P: [r, 0, START_SPEED_SD ** 2] };
        last = { t, x: zx, y: zy, X, Y };
        [rejects, seen] = [0, 1];
        return { t, x: X, y: Y, xPred: X, yPred: Y, dt: 0, source: point, restart: true };
      };
      if (!last) return start();
      const dt = t - last.t;
      if (dt <= 0) return null; // the same time twice, or out of order
      const reject = () => (++rejects >= MAX_REJECTS ? start() : null);
      if (Math.hypot(zx - last.x, zy - last.y) / dt > MAX_MPS) return reject();
      const xPred = predict(last.X, dt);
      const yPred = predict(last.Y, dt);
      const nx = zx - xPred.p;
      const ny = zy - yPred.p;
      if (seen >= 3 && (nx * nx) / (xPred.P[0] + r) + (ny * ny) / (yPred.P[0] + r) > GATE) return reject();
      const X = update(xPred, zx, r);
      const Y = update(yPred, zy, r);
      last = { t, x: zx, y: zy, X, Y };
      rejects = 0;
      seen++;
      return { t, x: X, y: Y, xPred, yPred, dt, source: point, restart: false };
    },
  };
}

const speed = (x: Axis, y: Axis) => Math.hypot(x.v, y.v);

// Whether `p` (moving at `mps`) is far enough on from `prev` to keep: moving, and `step` or its own uncertainty
// away. The first point is always kept.
const keeps = (prev: TrackPoint | undefined, p: TrackPoint, mps: number, step = MIN_STEP_M) => !prev || (mps >= STILL_MPS && distance(prev, p) >= Math.max(step, p.acc ?? 0));

function thin(points: { point: TrackPoint; mps: number }[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const [i, { point, mps }] of points.entries()) if (keeps(out.at(-1), point, mps) || (i === points.length - 1 && out.length < 2)) out.push(point);
  return out;
}

function distance(a: TrackPoint, b: TrackPoint): number {
  const mPerLon = M_PER_DEG * Math.cos(rad(a.lat));
  return Math.hypot((b.lon - a.lon) * mPerLon, (b.lat - a.lat) * M_PER_DEG);
}

/** The cleaned route of a whole walk: time-ordered, bad points dropped, smoothed forward and back, thinned. Each point's
 * `acc` is its remaining uncertainty in metres. Empty when no point is usable. */
export function cleanTrack(points: readonly TrackPoint[]): TrackPoint[] {
  const fw = forward();
  const segments: Step[][] = [];
  for (const p of [...points].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))) {
    const s = fw.add(p);
    if (!s) continue;
    if (s.restart) segments.push([]);
    segments.at(-1)!.push(s);
  }
  // a segment of fewer points than a restart needs was the stray start that made the filter start over
  const kept = segments.filter((seg, i) => i === segments.length - 1 || seg.length >= MAX_REJECTS);
  const out: { point: TrackPoint; mps: number }[] = [];
  for (const seg of kept) {
    const xs = seg.map((s) => s.x);
    const ys = seg.map((s) => s.y);
    for (let k = seg.length - 2; k >= 0; k--) {
      xs[k] = smooth(seg[k].x, seg[k + 1].xPred, xs[k + 1], seg[k + 1].dt);
      ys[k] = smooth(seg[k].y, seg[k + 1].yPred, ys[k + 1], seg[k + 1].dt);
    }
    out.push(...seg.map((s, k) => ({ point: fw.toPoint(s.source, xs[k], ys[k]), mps: speed(xs[k], ys[k]) })));
  }
  return thin(out);
}

/** The forward filter for a walk in progress: points as they come, the cleaned route and its distance so far. */
export function createLiveFilter(): { add(p: TrackPoint): void; distanceM(): number; points(): TrackPoint[] } {
  const fw = forward();
  const kept: TrackPoint[] = [];
  let candidate: TrackPoint | null = null; // the newest filtered point, not yet far enough from the last kept one
  let distanceM = 0;
  return {
    add(p) {
      const s = fw.add(p);
      if (!s) return;
      const point = fw.toPoint(s.source, s.x, s.y);
      const prev = kept.at(-1);
      if (prev && !s.restart && !keeps(prev, point, speed(s.x, s.y), LIVE_STEP_M)) {
        candidate = point;
        return;
      }
      if (prev && !s.restart) distanceM += distance(prev, point);
      kept.push(point);
      candidate = null;
    },
    distanceM: () => Math.round(distanceM),
    points: () => (candidate ? [...kept, candidate] : [...kept]),
  };
}
