import type { TrackPoint } from "@gassi/domain";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { loadKept } from "../data/kept";
import { clearDevice, saveDevice } from "../data/device";
import { storage } from "../data/storage";
import { backgroundWalk, beginBackground, distanceOf, type HeadlessDeps, type Location, locationOptions, notificationBody, onLocations, queuedFor, staleBackground, stopWhenSignedOut } from "./headless";
import { type Batch, createRecorder } from "./recorder";

const T0 = Date.parse("2026-10-24T12:00:00Z");
const loc = (s: number): Location => ({ timestamp: T0 + s * 1000, coords: { latitude: 48.137 + (s * 1.4) / 111_195, longitude: 11.575, altitude: null, accuracy: 5 } });
const kept = (walkKey: string) => (loadKept("recordings") as Record<string, { points: TrackPoint[]; ended: boolean }> | null)?.[walkKey];

// what the task gets from outside, recorded: uploads answer `recording` (or fail while `failing`)
function deps(recording = true) {
  const d = {
    now: T0,
    batches: [] as Batch[],
    stops: 0,
    shown: [] as TrackPoint[],
    failing: false,
    recording,
    queued: false,
    deps: null as unknown as HeadlessDeps,
  };
  d.deps = {
    now: () => d.now,
    upload: async (b) => {
      if (d.failing) throw new TypeError("Network request failed");
      d.batches.push(b);
      return { recording: d.recording };
    },
    stopService: async () => void d.stops++,
    queued: () => d.queued,
    onPoint: (p) => d.shown.push(p),
  };
  return d;
}

// a recording of walk "w" that a screen started earlier and then went away (the app's UI ended)
function recordingLeftBehind() {
  createRecorder({ walkKey: "w", geo: { watch: () => () => {} }, upload: async () => ({}), locks: null }).close();
  beginBackground("w", new Date(T0).toISOString());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

test("runs from storage alone: keeps the points, tells an open screen, and sends a batch after 30 s", async () => {
  recordingLeftBehind();
  const d = deps();
  await onLocations([loc(0), loc(5)], d.deps);
  expect(kept("w")?.points).toHaveLength(2);
  expect(d.shown).toHaveLength(2);
  expect(d.batches).toHaveLength(0);
  d.now = T0 + 30_000;
  await onLocations([loc(30)], d.deps);
  expect(d.batches.map((b) => [b.walkKey, b.seq, b.points.length])).toEqual([["w", 0, 3]]);
});

test("sends at most every 30 s", async () => {
  recordingLeftBehind();
  const d = deps();
  for (let s = 0; s <= 90; s += 5) {
    d.now = T0 + s * 1000;
    await onLocations([loc(s)], d.deps);
  }
  expect(d.batches).toHaveLength(3);
});

test("a failed upload keeps recording", async () => {
  recordingLeftBehind();
  const d = deps(false);
  d.failing = true;
  d.now = T0 + 30_000;
  await onLocations([loc(30)], d.deps);
  expect(d.stops).toBe(0);
  expect(backgroundWalk()?.walkKey).toBe("w");
  expect(kept("w")?.points).toHaveLength(1);
});

test("recording false ends it: the rest goes out, the service stops, the recording is forgotten", async () => {
  recordingLeftBehind();
  const d = deps(false);
  await onLocations([loc(0)], d.deps);
  d.now = T0 + 30_000;
  await onLocations([loc(30)], d.deps);
  expect(d.stops).toBe(1);
  expect(backgroundWalk()).toBeNull();
  expect(kept("w")).toBeUndefined();
  expect(d.batches.flatMap((b) => b.points)).toHaveLength(2);
});

test("a command for the walk still queued keeps it going (its start or takeover isn't on the server yet)", async () => {
  recordingLeftBehind();
  const d = deps(false);
  d.queued = true;
  d.now = T0 + 30_000;
  await onLocations([loc(30)], d.deps);
  expect(d.stops).toBe(0);
  expect(backgroundWalk()?.walkKey).toBe("w");
});

test("no background walk, or its recording gone: the locations are ignored and the service stops", async () => {
  const d = deps();
  await onLocations([loc(0)], d.deps);
  expect(d.stops).toBe(1);
  expect(d.shown).toHaveLength(0);
  beginBackground("gone", new Date(T0).toISOString());
  await onLocations([loc(5)], d.deps);
  expect(d.stops).toBe(2);
  expect(backgroundWalk()).toBeNull();
});

test("queuedFor finds a queued command for the walk in the person's queue", () => {
  storage.setItem("gassi.commands.herzii", JSON.stringify([{ id: "r", at: "2026-10-24T12:00:00.000Z", kind: "walk.record", walkKey: "w" }]));
  expect(queuedFor("herzii", "w")).toBe(true);
  expect(queuedFor("herzii", "other")).toBe(false);
  expect(queuedFor("hirsch", "w")).toBe(false);
});

test("the notification says since when and how far", async () => {
  recordingLeftBehind();
  await onLocations([loc(0), loc(500)], deps().deps);
  expect(Math.round(distanceOf("w"))).toBe(700);
  expect(notificationBody("2026-10-24T12:05:00.000Z", 0)).toMatch(/^Seit \d\d:05 · 0 m$/);
  expect(notificationBody("2026-10-24T12:05:00.000Z", 1234)).toMatch(/^Seit \d\d:05 · 1,2 km$/);
});

test("positions come every 5 s also standing still (a sniffing dog is no lost GPS, and the stop still arrives)", () => {
  expect(locationOptions("Seit 12:00 · 0 m")).toMatchObject({ timeInterval: 5000, distanceInterval: 0, foregroundService: { notificationTitle: "Runde läuft", notificationBody: "Seit 12:00 · 0 m", killServiceOnDestroy: false } });
});

test("a background recording of a walk this phone no longer records is stale", () => {
  expect(staleBackground("w", true)).toBe(false); // nothing kept
  beginBackground("w", new Date(T0).toISOString());
  expect(staleBackground("w", true)).toBe(false);
  expect(staleBackground("w", false)).toBe(true); // taken over, or the walk ended, while the app was closed
  expect(staleBackground(null, false)).toBe(true);
  expect(staleBackground("other", true)).toBe(true);
});

test("signing out stops the service at once, not at the next position", () => {
  saveDevice({ token: "t", serverUrl: "https://gassi.example.org", person: { id: "herzii", name: "Herzii" } });
  let stops = 0;
  const unsubscribe = stopWhenSignedOut(async () => void stops++);
  saveDevice({ token: "t2", serverUrl: "https://gassi.example.org", person: { id: "herzii", name: "Herzii" } });
  expect(stops).toBe(0); // signed in again, not out
  clearDevice();
  expect(stops).toBe(1);
  unsubscribe();
});
