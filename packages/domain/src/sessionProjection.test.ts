import { expect, test } from "vitest";
import type { Command } from "./commands";
import { project, type SessionsView } from "./sessionProjection";

const HIRSCH = { id: "marcel", name: "Hirsch" };
const HERZII = { id: "bille", name: "Herzii" };
const walking: SessionsView = { walk: { key: "w", startedAt: "2026-10-20T09:00:00.000Z", dogIds: [1], walkers: [HIRSCH], pauses: [], paused: false }, training: null };
const c = (at: string, body: object) => ({ id: at, at: `2026-10-20T09:${at}:00.000Z`, ...body }) as Command;

test("without pending commands the server's view is shown as it is", () => {
  expect(project(walking, [], HIRSCH)).toBe(walking);
});

test("a pending pause shows the walk as paused, a pending resume ends the pause", () => {
  const paused = project(walking, [c("10", { kind: "walk.pause", walkKey: "w" })], HIRSCH);
  expect(paused.walk).toMatchObject({ paused: true, pauses: [{ startedAt: "2026-10-20T09:10:00.000Z", endedAt: null }] });
  const resumed = project(walking, [c("10", { kind: "walk.pause", walkKey: "w" }), c("12", { kind: "walk.resume", walkKey: "w" })], HIRSCH);
  expect(resumed.walk).toMatchObject({ paused: false, pauses: [{ endedAt: "2026-10-20T09:12:00.000Z" }] });
});

test("a pending start shows a walk by me, a pending join adds me once", () => {
  expect(project({ walk: null, training: null }, [c("00", { kind: "walk.start", walkKey: "k", dogIds: [2] })], HIRSCH).walk).toEqual({ key: "k", startedAt: "2026-10-20T09:00:00.000Z", dogIds: [2], walkers: [HIRSCH], pauses: [], paused: false });
  const joined = project(walking, [c("01", { kind: "walk.join", walkKey: "w" }), c("02", { kind: "walk.join", walkKey: "w" })], HERZII);
  expect(joined.walk!.walkers).toEqual([HIRSCH, HERZII]);
});

test("a pending stop ends the walk and its training", () => {
  const training = project(walking, [c("05", { kind: "training.start", trainingKey: "t", walkKey: "w" })], HIRSCH);
  expect(training.training).toEqual({ key: "t", startedAt: "2026-10-20T09:05:00.000Z", dogIds: [], walkKey: "w", reps: [], treats: {} });
  expect(project(walking, [c("05", { kind: "training.start", trainingKey: "t", walkKey: "w" }), c("30", { kind: "walk.stop", walkKey: "w" })], HIRSCH)).toEqual({ walk: null, training: null });
});

test("pending treat taps show, treats never below 0, in time order", () => {
  const home: SessionsView = { walk: null, training: { key: "t", startedAt: "2026-10-20T09:00:00.000Z", dogIds: [1], walkKey: null, reps: [], treats: { 7: 1 } } };
  const v = project(
    home,
    [c("04", { kind: "training.treat", trainingKey: "t", treatKindId: 7, delta: -1 }), c("05", { kind: "training.treat", trainingKey: "t", treatKindId: 7, delta: -1 })],
    HIRSCH,
  );
  expect(v.training).toMatchObject({ treats: { 7: 0 } });
});

test("a pending start from this phone gives its key to the walk and training shown (a cached page may hold an old one)", () => {
  const cached: SessionsView = { walk: { key: "old", startedAt: "2026-10-19T09:00:00.000Z", dogIds: [1], walkers: [HIRSCH], pauses: [], paused: false }, training: { key: "old-t", startedAt: "2026-10-19T09:05:00.000Z", dogIds: [1], walkKey: "old", reps: [], treats: {} } };
  const v = project(cached, [c("00", { kind: "walk.start", walkKey: "new" }), c("01", { kind: "training.start", trainingKey: "new-t", walkKey: "new" })], HIRSCH);
  expect(v.walk!.key).toBe("new");
  expect(v.training!.key).toBe("new-t");
});

const repTraining: SessionsView = { walk: null, training: { key: "t", startedAt: "2026-10-20T09:00:00.000Z", dogIds: [1, 2], walkKey: null, reps: [], treats: {} } };
const rep = (at: string, dogId: number, ok: boolean, delta: 1 | -1 = 1) => c(at, { kind: "training.rep", trainingKey: "t", exerciseId: 1, dogId, ok, delta });

test("training.rep counts ok and fail per exercise and dog", () => {
  const v = project(repTraining, [rep("01", 1, true), rep("02", 1, true), rep("03", 1, false), rep("04", 2, true)], HIRSCH);
  expect(v.training!.reps).toEqual([
    { exerciseId: 1, dogId: 1, ok: 2, fail: 1 },
    { exerciseId: 1, dogId: 2, ok: 1, fail: 0 },
  ]);
});

test("a rep with delta -1 never goes below zero", () => {
  expect(project(repTraining, [rep("01", 1, true, -1)], HIRSCH).training!.reps).toEqual([{ exerciseId: 1, dogId: 1, ok: 0, fail: 0 }]);
});

test("a rep for a dog outside the training is left out", () => {
  expect(project(repTraining, [rep("01", 3, true)], HIRSCH).training!.reps).toEqual([]);
});

test("with no dogs listed (the server picks them) a rep is kept", () => {
  const open: SessionsView = { walk: null, training: { ...repTraining.training!, dogIds: [] } };
  expect(project(open, [rep("01", 3, true)], HIRSCH).training!.reps).toEqual([{ exerciseId: 1, dogId: 3, ok: 1, fail: 0 }]);
});
