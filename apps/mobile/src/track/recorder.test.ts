import type { TrackPoint } from "@gassi/domain";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { clearKept, loadKept } from "../data/kept";
import { createRecorder, type Batch, endRecording, type Geo, keepPoint, type Locks, RejectedBatch, sendLeftovers, sendRecording } from "./recorder";

const T0 = Date.parse("2026-10-24T09:00:00Z");
const point = (s: number, acc = 5): TrackPoint => ({ t: new Date(T0 + s * 1000).toISOString(), lat: 48.137 + (s * 1.4) / 111_195, lon: 11.575, ele: null, acc });

// a position source the test drives: `fix(s, acc)` delivers the point at `s` seconds, `deny()` refuses
function fakeGeo() {
  let handlers: { onPoint: (p: TrackPoint) => void; onDenied: () => void } | null = null;
  const geo: Geo & { watching: () => boolean; ended: number; fix(s: number, acc?: number): void; deny(): void } = {
    ended: 0,
    watch(_walkKey, onPoint, onDenied) {
      handlers = { onPoint, onDenied };
      return () => void (handlers = null);
    },
    watching: () => handlers !== null,
    fix: (s, acc) => handlers?.onPoint(point(s, acc)),
    deny: () => handlers?.onDenied(),
    async end() {
      geo.ended++;
    },
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
  await sendLeftovers(up.send, null);
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(2);
  await sendLeftovers(up.send, null);
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(2);
});

test("a recording handed over is sent and forgotten once its walk no longer runs", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  up.failing = 99;
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 10);
  r.close(); // another phone took over
  up.failing = 0;
  await sendLeftovers(up.send, "w"); // the walk still runs: sent, kept
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(2);
  expect(Object.keys(loadKept("recordings") as object)).toEqual(["w"]);
  await sendLeftovers(up.send, null); // it ended
  expect(loadKept("recordings")).toEqual({});
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

test("only network fixes for a minute mean rough, until GPS comes back", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  for (let s = 0; s <= 60; s += 5) {
    geo.fix(s, 250);
    await vi.advanceTimersByTimeAsync(5000);
  }
  expect(r.status()).toBe("rough");
  geo.fix(65, 12);
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

test("a recorder takes back a recording that was taken for over (the app opened before it knew the walk)", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  up.failing = 99;
  const first = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 0, 10);
  first.close();
  await sendLeftovers(up.send, null); // no walk known yet, and no reception: kept as over
  up.failing = 0;
  const again = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  await walkFor(geo, 10, 40); // a batch goes out on the way; the recording must not be forgotten after it
  await again.stop();
  expect(up.batches.flatMap((b) => b.points)).toHaveLength(10);
});

test("a position the server would refuse (accuracy of kilometres, a height out of range) isn't kept", async () => {
  let handlers: { onPoint: (p: TrackPoint) => void } | null = null;
  const geo: Geo = { watch: (_walkKey, onPoint) => ((handlers = { onPoint }), () => {}) };
  const up = fakeUpload();
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  handlers!.onPoint({ ...point(0), acc: 25_000 }); // a laptop's guess from its network
  handlers!.onPoint({ ...point(5), ele: 12_000 });
  handlers!.onPoint(point(10));
  await r.stop();
  expect(up.batches.flatMap((b) => b.points).map((p) => p.t)).toEqual([point(10).t]);
});

test("a batch the server refuses for good is tried again while its walk runs, and given up once it is over", async () => {
  const geo = fakeGeo();
  const tries: number[] = [];
  // "Diese Runde gibt es nicht.": the walk's start never reached the server
  const refuse = async (b: Batch) => {
    tries.push(b.seq);
    throw new RejectedBatch();
  };
  const r = createRecorder({ walkKey: "w", geo, upload: refuse, locks: null });
  await walkFor(geo, 0, 65);
  expect(tries.length).toBeGreaterThan(1); // the start may still be on its way: kept
  expect(Object.keys(loadKept("recordings") as object)).toEqual(["w"]);
  await r.stop();
  expect(loadKept("recordings")).toEqual({});
  const before = tries.length;
  await sendLeftovers(refuse, null);
  expect(tries.length).toBe(before);
});

test("a tab waiting for the lock shows the recording tab's distance", async () => {
  let held = false;
  const locks: Locks = {
    request: async (_name, fn) => {
      if (held) return new Promise<void>(() => {}); // waits for good in this test
      held = true;
      await fn();
    },
  };
  const [a, b] = [fakeGeo(), fakeGeo()];
  const recording = createRecorder({ walkKey: "w", geo: a, upload: fakeUpload().send, locks });
  const waiting = createRecorder({ walkKey: "w", geo: b, upload: fakeUpload().send, locks });
  await vi.advanceTimersByTimeAsync(0);
  expect(b.watching()).toBe(false);
  await walkFor(a, 0, 300);
  expect(recording.distanceM()).toBeGreaterThan(350);
  expect(waiting.distanceM()).toBe(recording.distanceM());
  expect(waiting.status()).toBe("on");
  recording.close();
  waiting.close();
});

test("keepPoint drops a repeated or refused point", () => {
  createRecorder({ walkKey: "w", geo: fakeGeo(), upload: fakeUpload().send, locks: null }).close();
  expect(keepPoint("w", point(0))).toBe(true);
  expect(keepPoint("w", point(0))).toBe(false); // the same time again
  expect(keepPoint("w", { ...point(5), acc: 50_000 })).toBe(false); // the contract refuses it
  expect(keepPoint("other", point(5))).toBe(false); // no recording of that walk
  expect((loadKept("recordings") as Record<string, { points: TrackPoint[] }>).w.points).toEqual([point(0)]);
});

test("keepPoint drops a point older than the last, delivered again late", () => {
  createRecorder({ walkKey: "w", geo: fakeGeo(), upload: fakeUpload().send, locks: null }).close();
  keepPoint("w", point(0));
  keepPoint("w", point(5));
  expect(keepPoint("w", point(0))).toBe(false);
  expect((loadKept("recordings") as Record<string, { points: TrackPoint[] }>).w.points).toEqual([point(0), point(5)]);
});

test("a sign-out while a batch is out keeps nothing of the recording", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  geo.fix(0);
  r.close();
  await sendRecording("w", async () => {
    clearKept(); // signed out meanwhile
    return { stored: true, recording: true };
  });
  expect(loadKept("recordings")?.["w" as never]).toBeUndefined();
});

test("a point kept elsewhere (the background task) shows once", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  keepPoint("w", point(0));
  geo.fix(0); // the task tells the open screen of the point it kept
  geo.fix(5);
  expect(r.points()).toHaveLength(2);
  expect((loadKept("recordings") as Record<string, { points: TrackPoint[] }>).w.points).toHaveLength(2);
  r.close();
});

test("sendRecording returns the server's last answer", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  geo.fix(0);
  r.close();
  expect(await sendRecording("w", async () => ({ stored: true, recording: false }))).toEqual({ stored: true, recording: false });
  expect(await sendRecording("w", async () => ({ stored: true, recording: true }))).toBeUndefined(); // nothing left to send
});

test("stop ends the background before sending the rest; close only lets go", async () => {
  const geo = fakeGeo();
  const up = fakeUpload();
  const first = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  first.close();
  expect(geo.ended).toBe(0);
  const r = createRecorder({ walkKey: "w", geo, upload: up.send, locks: null });
  geo.fix(0);
  await r.stop();
  expect(geo.ended).toBe(1);
  expect(up.batches).toHaveLength(1);
  expect(loadKept("recordings")).toEqual({});
});

test("endRecording marks it over, so the rest is sent and the recording forgotten", async () => {
  const geo = fakeGeo();
  const r = createRecorder({ walkKey: "w", geo, upload: fakeUpload().send, locks: null });
  geo.fix(0);
  r.close();
  endRecording("w");
  await sendRecording("w", async () => ({ stored: true, recording: false }));
  expect(loadKept("recordings")).toEqual({});
});
