import type { TrackPoint } from "@gassi/domain";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createRecorder, type Batch, type Geo, type Locks, sendLeftovers } from "./recorder";

const T0 = Date.parse("2026-10-24T09:00:00Z");
const point = (s: number): TrackPoint => ({ t: new Date(T0 + s * 1000).toISOString(), lat: 48.137 + (s * 1.4) / 111_195, lon: 11.575, ele: null, acc: 5 });

// a position source the test drives: `fix(s)` delivers the point at `s` seconds, `deny()` refuses
function fakeGeo() {
  let handlers: { onPoint: (p: TrackPoint) => void; onDenied: () => void } | null = null;
  const geo: Geo & { watching: () => boolean; fix(s: number): void; deny(): void } = {
    watch(onPoint, onDenied) {
      handlers = { onPoint, onDenied };
      return () => void (handlers = null);
    },
    watching: () => handlers !== null,
    fix: (s) => handlers?.onPoint(point(s)),
    deny: () => handlers?.onDenied(),
  };
  return geo;
}

function fakeUpload() {
  const batches: Batch[] = [];
  const upload = { batches, failing: 0, send: async (b: Batch) => {
    if (upload.failing > 0) {
      upload.failing--;
      throw new TypeError("Failed to fetch");
    }
    batches.push(b);
  } };
  return upload;
}

// steps the clock `s` seconds, delivering a fix each 5 s on the way
async function walkFor(geo: ReturnType<typeof fakeGeo>, from: number, s: number) {
  for (let t = from; t < from + s; t += 5) {
    geo.fix(t);
    await vi.advanceTimersByTimeAsync(5000);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

test("sends a batch every 30 s and the rest on stop", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 40);
  expect(up.batches).toHaveLength(1);
  expect(up.batches[0]).toMatchObject({ walkKey: "w", source: "phone", seq: 0 });
  expect(up.batches[0].points.length).toBe(6);
  await r.stop();
  expect(up.batches.map((b) => [b.seq, b.points.length])).toEqual([[0, 6], [1, 2]]);
  expect(geo.watching()).toBe(false);
});

test("resumes after a reload", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  up.failing = 99;
  const first = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 20);
  first.close(); // the page goes away without stopping the walk
  up.failing = 0;
  const again = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 20, 15);
  await again.stop();
  expect(new Set(up.batches.map((b) => b.trackId)).size).toBe(1);
  expect(up.batches.map((b) => b.seq)).toEqual(up.batches.map((_, i) => i));
  expect(up.batches.flatMap((b) => b.points).map((p) => p.t)).toEqual([0, 5, 10, 15, 20, 25, 30].map((s) => point(s).t));
});

test("a failed upload stays and goes later, with the same seq and points", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  up.failing = 1;
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 65);
  await r.stop();
  expect(up.batches[0]).toMatchObject({ seq: 0 });
  expect(up.batches[0].points.map((p) => p.t)).toEqual([0, 5, 10, 15, 20, 25].map((s) => point(s).t));
  expect(up.batches.map((b) => b.seq)).toEqual(up.batches.map((_, i) => i));
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(13);
});

test("a recording that couldn't go out at the end goes with the next chance", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  up.failing = 99;
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 10);
  await r.stop();
  up.failing = 0;
  await sendLeftovers(up.send);
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(2);
  await sendLeftovers(up.send);
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(2);
});

test("no fix for 30 s means noSignal", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  expect(r.status()).toBe("on");
  await vi.advanceTimersByTimeAsync(31_000);
  expect(r.status()).toBe("noSignal");
  geo.fix(31);
  expect(r.status()).toBe("on");
  r.close();
});

test("denied means denied", () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  geo.deny();
  expect(r.status()).toBe("denied");
  r.close();
});

test("the live distance grows with the walk", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  await walkFor(geo, 0, 300);
  expect(r.distanceM()).toBeGreaterThan(350);
  expect(r.distanceM()).toBeLessThan(500);
  r.close();
});

test("only one tab records", async () => {
  // a lock like navigator.locks: the second request waits until the first holder lets go
  let held = false;
  const waiting: (() => void)[] = [];
  const locks: Locks = {
    request: async (_name, fn) => {
      if (held) await new Promise<void>((go) => waiting.push(go));
      held = true;
      await fn();
      held = false;
      waiting.shift()?.();
    },
  };
  const [a, b] = [fakeGeo(), fakeGeo()];
  const first = createRecorder({ walkKey: "w", geo: a, upload: fakeUpload().send, locks });
  const second = createRecorder({ walkKey: "w", geo: b, upload: fakeUpload().send, locks });
  await vi.advanceTimersByTimeAsync(0);
  expect([a.watching(), b.watching()]).toEqual([true, false]);
  first.close();
  await vi.advanceTimersByTimeAsync(0);
  expect(b.watching()).toBe(true);
  second.close();
});
