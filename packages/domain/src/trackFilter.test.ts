import { describe, expect, test } from "vitest";
import { type TrackPoint, trackMetrics } from "./track";
import { cleanTrack, createLiveFilter } from "./trackFilter";

const T0 = Date.parse("2026-10-20T09:00:00Z");
const LAT0 = 48.137;
const M_PER_LON = 111_195 * Math.cos((LAT0 * Math.PI) / 180);
// a point `east`/`north` metres from Munich's Marienplatz, `s` seconds after T0
const at = (s: number, east: number, north: number, acc: number | null = 8): TrackPoint => ({
  t: new Date(T0 + s * 1000).toISOString(),
  lat: LAT0 + north / 111_195,
  lon: 11.575 + east / M_PER_LON,
  ele: null,
  acc,
});
const northOf = (p: TrackPoint) => (p.lat - LAT0) * 111_195;

// a seeded Gaussian, so a failing run fails the same way again
function noise(seed: number) {
  let a = seed;
  const uniform = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (sigma: number) => sigma * Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform());
}

// 1000 m east at 1.4 m/s, a point every 5 s, with σ = 8 m noise; `skip` leaves out the points in [from, to) seconds
function noisyLine({ seed = 1, skip }: { seed?: number; skip?: [number, number] } = {}): TrackPoint[] {
  const n = noise(seed);
  const out: TrackPoint[] = [];
  for (let s = 0; s * 1.4 <= 1000; s += 5) if (!skip || s < skip[0] || s >= skip[1]) out.push(at(s, s * 1.4 + n(8), n(8)));
  return out;
}

describe("cleanTrack", () => {
  test("keeps distance of a noisy straight walk close", () => {
    const pts = noisyLine();
    expect(trackMetrics(pts).distanceM).toBeGreaterThan(1100);
    expect(Math.abs(trackMetrics(cleanTrack(pts)).distanceM - 1000)).toBeLessThan(50);
  });

  test("follows a turn", () => {
    // 500 m east, then 500 m north
    const n = noise(4);
    const pts: TrackPoint[] = [];
    for (let s = 0; s * 1.4 <= 1000; s += 5) {
      const d = s * 1.4;
      pts.push(at(s, Math.min(d, 500) + n(8), Math.max(0, d - 500) + n(8)));
    }
    const clean = cleanTrack(pts);
    expect(Math.abs(trackMetrics(clean).distanceM - 1000)).toBeLessThan(50);
    const corner = Math.min(...clean.map((p) => Math.hypot((p.lon - 11.575) * M_PER_LON - 500, northOf(p))));
    expect(corner).toBeLessThan(20);
  });

  test("drops points with bad or missing accuracy", () => {
    const pts = noisyLine();
    pts[20] = { ...pts[20], acc: 45 };
    pts[40] = { ...pts[40], acc: null };
    const times = new Set(cleanTrack(pts).map((p) => p.t));
    expect(times.has(pts[20].t)).toBe(false);
    expect(times.has(pts[40].t)).toBe(false);
  });

  test("drops a multipath jump", () => {
    const pts = noisyLine();
    pts[60] = { ...pts[60], lat: LAT0 + 300 / 111_195 };
    for (const p of cleanTrack(pts)) expect(Math.abs(northOf(p))).toBeLessThan(30);
  });

  test("standing still adds nothing", () => {
    const n = noise(2);
    const pts = Array.from({ length: 120 }, (_, i) => at(i * 5, n(8), n(8)));
    expect(trackMetrics(cleanTrack(pts)).distanceM).toBeLessThan(15);
  });

  test("bridges a gap", () => {
    const pts = noisyLine({ skip: [300, 600] });
    expect(Math.abs(trackMetrics(cleanTrack(pts)).distanceM - 1000)).toBeLessThan(50);
  });

  test("nothing usable gives nothing", () => {
    expect(cleanTrack(noisyLine().map((p) => ({ ...p, acc: 60 })))).toEqual([]);
    expect(cleanTrack([])).toEqual([]);
  });
});

describe("createLiveFilter", () => {
  test("live filter agrees", () => {
    const f = createLiveFilter();
    for (const p of noisyLine({ seed: 3 })) f.add(p);
    expect(Math.abs(f.distanceM() - 1000)).toBeLessThan(80);
    expect(f.points().length).toBeGreaterThan(10);
  });
});
