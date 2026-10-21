import { describe, expect, test } from "vitest";
import { chooseTrack, simplify, trimTrack, type TrackPoint, trackMetrics } from "./track";

const T0 = Date.parse("2026-10-20T09:00:00Z");
// a point `north` metres north and `east` metres east of Munich's Marienplatz, `s` seconds after T0
const p = (s: number, north: number, east = 0, ele: number | null = null): TrackPoint => ({
  t: new Date(T0 + s * 1000).toISOString(),
  lat: 48.137 + north / 111_195,
  lon: 11.575 + east / (111_195 * Math.cos((48.137 * Math.PI) / 180)),
  ele,
  acc: 5,
});

describe("trackMetrics", () => {
  test("distance of a 1 km straight line is 1000 m ±1", () => {
    const m = trackMetrics([p(0, 0), p(300, 500), p(600, 1000)]);
    expect(Math.abs(m.distanceM - 1000)).toBeLessThan(1);
    expect(m.durationS).toBe(600);
    expect(m.paceSPerKm).toBeCloseTo(600, 0);
  });

  test("pauses don't count as moving time", () => {
    const m = trackMetrics([p(0, 0), p(300, 500), p(900, 502), p(1200, 1000)]); // 10 minutes standing (2 m drift)
    expect(m.durationS).toBe(1200);
    expect(m.movingS).toBe(600);
    expect(m.paceSPerKm).toBeCloseTo(600, -1);
  });

  test("elevation noise below 3 m is ignored", () => {
    const eles = [500, 501, 499, 502, 500, 506, 510, 509, 511, 504];
    const m = trackMetrics(eles.map((e, i) => p(i * 60, i * 50, 0, e)));
    expect(m.ascentM).toBe(11); // 500 → 506 → 511
    expect(m.descentM).toBe(7); // 511 → 504
  });

  test("no points, one point, or points without movement have no pace", () => {
    expect(trackMetrics([])).toEqual({ distanceM: 0, durationS: 0, movingS: 0, paceSPerKm: null, ascentM: 0, descentM: 0, bbox: null });
    expect(trackMetrics([p(0, 0)]).paceSPerKm).toBeNull();
  });

  test("points come in any order; they are taken by time", () => {
    expect(trackMetrics([p(600, 1000), p(0, 0), p(300, 500)]).durationS).toBe(600);
  });
});

describe("trimTrack", () => {
  test("keeps the ends and corners, drops points on a straight line", () => {
    const line = [p(0, 0), p(10, 100), p(20, 200), p(30, 300), p(40, 300, 100), p(50, 300, 200)];
    expect(trimTrack(line).map((x) => x.t)).toEqual([line[0].t, line[3].t, line[5].t]);
  });

  test("a wiggle under the tolerance goes, one over it stays", () => {
    expect(trimTrack([p(0, 0), p(10, 50, 3), p(20, 100)])).toHaveLength(2);
    expect(trimTrack([p(0, 0), p(10, 50, 20), p(20, 100)])).toHaveLength(3);
  });
});

describe("chooseTrack", () => {
  test("the watch track is chosen over a longer phone track; else the longest", () => {
    expect(chooseTrack([{ source: "phone", distanceM: 3000 }, { source: "watch", distanceM: 2500 }])).toBe(1);
    expect(chooseTrack([{ source: "phone", distanceM: 1000 }, { source: "phone", distanceM: 3000 }])).toBe(1);
    expect(chooseTrack([])).toBeNull();
  });
});

describe("simplify", () => {
  test("thins 1000 points to 64, evenly spaced, with the ends", () => {
    const line = Array.from({ length: 1000 }, (_, i) => p(i, i * 2));
    const out = simplify(line, 64);
    expect(out).toHaveLength(64);
    expect(out[0]).toEqual([line[0].lat, line[0].lon]);
    expect(out[63]).toEqual([line[999].lat, line[999].lon]);
  });

  test("leaves short lines alone", () => {
    expect(simplify([p(0, 0), p(1, 1)], 64)).toHaveLength(2);
    expect(simplify([], 64)).toEqual([]);
  });
});
