// GPS tracks of walks: the points a phone or watch recorded, and what they add up to (distance, time moving, pace,
// climb), plus a lighter copy for drawing. Pure; the server stores the points and the app draws them.

export type TrackPoint = { t: string; lat: number; lon: number; ele: number | null; acc: number | null };
export type TrackSource = "phone" | "watch";
export type TrackMetrics = {
  distanceM: number;
  durationS: number;
  movingS: number; // only segments faster than MOVING_MPS
  paceSPerKm: number | null; // moving time per km; null under 10 m
  ascentM: number;
  descentM: number;
  bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number] | null;
};

const EARTH_M = 6_371_008.8;
const MOVING_MPS = 0.5;
const CLIMB_NOISE_M = 3;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: Pick<TrackPoint, "lat" | "lon">, b: Pick<TrackPoint, "lat" | "lon">): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const byTime = (points: readonly TrackPoint[]) => [...points].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
const round = (n: number, digits = 0) => Math.round(n * 10 ** digits) / 10 ** digits;

// Climb with hysteresis: a change counts once it is CLIMB_NOISE_M away from the last turning point, and then keeps
// counting in the same direction (so 500 → 506 → 511 is 11 m up, while 500 → 502 → 500 is nothing).
function climb(eles: number[]): { ascentM: number; descentM: number } {
  let [ascentM, descentM, dir] = [0, 0, 0];
  let ref = eles[0];
  for (const e of eles.slice(1)) {
    const d = e - ref;
    if (d > 0 && (dir === 1 || d >= CLIMB_NOISE_M)) [ascentM, ref, dir] = [ascentM + d, e, 1];
    else if (d < 0 && (dir === -1 || -d >= CLIMB_NOISE_M)) [descentM, ref, dir] = [descentM - d, e, -1];
  }
  return { ascentM: round(ascentM), descentM: round(descentM) };
}

export function trackMetrics(points: readonly TrackPoint[]): TrackMetrics {
  const ps = byTime(points);
  if (ps.length === 0) return { distanceM: 0, durationS: 0, movingS: 0, paceSPerKm: null, ascentM: 0, descentM: 0, bbox: null };
  let [distanceM, movingS] = [0, 0];
  for (let i = 1; i < ps.length; i++) {
    const d = haversine(ps[i - 1], ps[i]);
    const s = (Date.parse(ps[i].t) - Date.parse(ps[i - 1].t)) / 1000;
    distanceM += d;
    if (s > 0 && d / s > MOVING_MPS) movingS += s;
  }
  const lats = ps.map((p) => p.lat);
  const lons = ps.map((p) => p.lon);
  const eles = ps.map((p) => p.ele).filter((e): e is number => e !== null);
  return {
    distanceM: round(distanceM, 1),
    durationS: Math.round((Date.parse(ps.at(-1)!.t) - Date.parse(ps[0].t)) / 1000),
    movingS: Math.round(movingS),
    paceSPerKm: distanceM >= 10 ? Math.round(movingS / (distanceM / 1000)) : null,
    ...(eles.length ? climb(eles) : { ascentM: 0, descentM: 0 }),
    bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}

/** Douglas-Peucker on a local flat projection: drops points closer than `toleranceM` to the line through their
 * neighbours, keeping the ends and the corners. For drawing; metrics use all points. */
export function simplify(points: readonly TrackPoint[], toleranceM = 5): TrackPoint[] {
  const ps = byTime(points);
  if (ps.length < 3) return ps;
  const lat0 = rad(ps[0].lat);
  const xy = ps.map((p) => [rad(p.lon) * Math.cos(lat0) * EARTH_M, rad(p.lat) * EARTH_M] as const);
  const keep = new Array<boolean>(ps.length).fill(false);
  keep[0] = keep[ps.length - 1] = true;
  const stack: [number, number][] = [[0, ps.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay);
    let [far, farD] = [-1, 0];
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > farD) [far, farD] = [i, d];
    }
    if (far !== -1 && farD > toleranceM) {
      keep[far] = true;
      stack.push([a, far], [far, b]);
    }
  }
  return ps.filter((_, i) => keep[i]);
}

/** The track a walk shows: a watch's (the best GPS), else the longest. The index, or null without tracks. */
export function chooseTrack(tracks: readonly { source: TrackSource; distanceM: number }[]): number | null {
  if (tracks.length === 0) return null;
  const rank = (t: { source: TrackSource; distanceM: number }) => (t.source === "watch" ? 1e12 : 0) + t.distanceM;
  return tracks.reduce((best, t, i) => (rank(t) > rank(tracks[best]) ? i : best), 0);
}
