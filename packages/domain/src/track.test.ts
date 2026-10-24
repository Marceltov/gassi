import { describe, expect, test } from "vitest";
import { joinTracks, simplify, trimTrack, type TrackPoint, trackMetrics } from "./track";

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

describe("joinTracks", () => {
  const min = (m: number) => new Date(T0 + m * 60_000).toISOString();
  // a point every minute from `from` to `to` (minutes after T0), `east` metres east to tell the devices apart
  const run = (from: number, to: number, east: number) => Array.from({ length: to - from + 1 }, (_, i) => p((from + i) * 60, (from + i) * 80, east));
  const walk = { at: min(0), endedAt: min(40) };

  test("takes each recorder's points for its own time", () => {
    const out = joinTracks(
      [
        { deviceId: 1, source: "phone", points: run(0, 40, 0) },
        { deviceId: 2, source: "phone", points: run(0, 40, 50) },
      ],
      [{ deviceId: 1, from: min(0) }, { deviceId: 2, from: min(20) }],
      walk,
    );
    const east = (q: TrackPoint) => Math.round((q.lon - 11.575) * 111_195 * Math.cos((48.137 * Math.PI) / 180));
    expect(out.filter((q) => q.t < min(20)).every((q) => east(q) === 0)).toBe(true);
    expect(out.filter((q) => q.t >= min(20)).every((q) => east(q) === 50)).toBe(true);
    expect(out).toHaveLength(41);
  });

  test("cuts points outside the walk", () => {
    const out = joinTracks([{ deviceId: 1, source: "phone", points: run(-5, 45, 0) }], [{ deviceId: 1, from: min(0) }], walk);
    expect(out[0].t).toBe(min(0));
    expect(out.at(-1)!.t).toBe(min(40));
  });

  test("a running walk keeps its newest points", () => {
    expect(joinTracks([{ deviceId: 1, source: "phone", points: run(0, 45, 0) }], [{ deviceId: 1, from: min(0) }], { at: min(0), endedAt: null })).toHaveLength(46);
  });

  test("a watch track wins", () => {
    const watch = run(0, 40, 50);
    expect(joinTracks([{ deviceId: 1, source: "phone", points: run(0, 40, 0) }, { deviceId: null, source: "watch", points: watch }], [{ deviceId: 1, from: min(0) }], walk)).toEqual(watch);
  });

  test("drops duplicate times", () => {
    const pts = run(0, 3, 0);
    expect(joinTracks([{ deviceId: 1, source: "phone", points: [...pts, ...pts] }], [{ deviceId: 1, from: min(0) }], walk)).toHaveLength(4);
  });

  test("no recorders: the track with the most points", () => {
    expect(joinTracks([{ deviceId: 1, source: "phone", points: run(0, 3, 0) }, { deviceId: 2, source: "phone", points: run(0, 10, 50) }], [], walk)).toHaveLength(11);
    expect(joinTracks([], [], walk)).toEqual([]);
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
