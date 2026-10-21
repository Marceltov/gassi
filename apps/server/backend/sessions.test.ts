import { describe, expect, test } from "vitest";
import type { Command } from "@gassi/domain";
import { Catalog } from "./catalog";
import { freshDatabase } from "./db/testing";
import { EntryRepository } from "./entries/repository";
import { Sessions } from "./sessions";

const { db } = freshDatabase();
const HIRSCH = { id: "marcel", name: "Hirsch" };
const HERZII = { id: "bille", name: "Herzii" };
const names = new Map([
  ["marcel", "Hirsch"],
  ["bille", "Herzii"],
]);
const sessions = () => new Sessions({ db: db(), names, now: () => new Date("2026-10-20T12:00:00Z") });
const entries = () => new EntryRepository(db()).list({ dogId: 1 });

let n = 0;
/** A command at 09:mm (or a full ISO time) with a fresh id. */
const at = (t: string | number) => (typeof t === "number" ? `2026-10-20T09:${String(t).padStart(2, "0")}:00.000Z` : t);
type Body = Command extends infer C ? (C extends Command ? Omit<C, "id" | "at"> : never) : never;
const cmd = (t: string | number, c: Body & { id?: string }) => ({ id: `c${++n}`, at: at(t), ...c }) as Command;

describe("walks", () => {
  test("start, pause, resume, stop gives 52 min with 8 min pause", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(20, { kind: "walk.pause", walkKey: "w" }), cmd(28, { kind: "walk.resume", walkKey: "w" }), cmd(52, { kind: "walk.stop", walkKey: "w" })]);
    const [walk] = await entries();
    expect(walk).toMatchObject({ type: "walk", at: at(0), endedAt: at(52), durationMin: 52, loggedBy: "marcel" });
    expect(await s.summary(walk.id)).toMatchObject({ startedAt: at(0), endedAt: at(52), totalMin: 52, pauseMin: 8, pauseCount: 1, walkers: [HIRSCH] });
    expect(await s.current()).toEqual({ walk: null, training: null });
  });

  test("the summary is found by any key of the walk and carries the entry's id and note", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w1" })]);
    await s.apply(HERZII, [cmd(1, { kind: "walk.start", walkKey: "w2" }), cmd(30, { kind: "walk.stop", walkKey: "w2" })]);
    const walk = (await entries())[0];
    expect(await s.summaryFor("w2")).toMatchObject({ id: walk.id, note: null, totalMin: 30, walkers: [HIRSCH, HERZII] });
    expect(await s.summaryFor("w1")).toMatchObject({ id: walk.id });
    expect(await s.summaryFor("nope")).toBeNull();
  });

  test("a running walk shows who walks, since when and whether it is paused", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(10, { kind: "walk.pause", walkKey: "w" })]);
    expect((await s.current()).walk).toEqual({ key: "w", startedAt: at(0), dogIds: [1], walkers: [HIRSCH], pauses: [{ startedAt: at(10), endedAt: null }], paused: true });
  });

  test("second start joins the running walk", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w1" })]);
    await s.apply(HERZII, [cmd(1, { kind: "walk.start", walkKey: "w2" }), cmd(5, { kind: "walk.pause", walkKey: "w2" })]);
    expect(await entries()).toHaveLength(1);
    const walk = (await s.current()).walk!;
    expect(walk).toMatchObject({ key: "w1", walkers: [HIRSCH, HERZII], paused: true });
  });

  test("a start that arrives after the walk ended joins that walk", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w1" }), cmd(40, { kind: "walk.stop", walkKey: "w1" })]);
    await s.apply(HERZII, [cmd(1, { kind: "walk.start", walkKey: "w2" }), cmd(5, { kind: "log", type: "pee", dogId: 1 })]); // queued without reception
    expect((await entries()).filter((e) => e.type === "walk")).toHaveLength(1);
    expect(await s.current()).toEqual({ walk: null, training: null });
    expect(await s.summaryFor("w2")).toMatchObject({ totalMin: 40, walkers: [HIRSCH, HERZII], pee: 1 });
  });

  test("a start does not join a walk whose end was edited into the future", async () => {
    const s = sessions(); // now is 12:00
    await s.apply(HIRSCH, [cmd("2026-10-20T11:50:00.000Z", { kind: "walk.start", walkKey: "w1" })]);
    const first = (await entries())[0];
    await new EntryRepository(db()).update(first.id, { at: first.at, endedAt: "2026-10-20T12:20:00.000Z", amountG: null, foodKind: null, unitG: null, note: null });
    await s.apply(HERZII, [cmd("2026-10-20T11:59:00.000Z", { kind: "walk.start", walkKey: "w2" })]);
    expect((await s.current()).walk).toMatchObject({ key: "w2", walkers: [HERZII] });
  });

  test("a late training start on an ended walk ends with the walk", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(40, { kind: "walk.stop", walkKey: "w" })]);
    await s.apply(HERZII, [cmd(10, { kind: "training.start", trainingKey: "t", walkKey: "w" })]);
    expect(await s.current()).toEqual({ walk: null, training: null });
    expect((await entries()).find((e) => e.type === "training")).toMatchObject({ at: at(10), endedAt: at(40) });
    await s.apply(HERZII, [cmd(50, { kind: "training.stop", trainingKey: "t" })]);
    expect((await entries()).find((e) => e.type === "training")).toMatchObject({ endedAt: at(40) });
  });

  test("a joining start with an earlier time moves the walk's start back", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(2, { kind: "walk.start", walkKey: "w1" })]);
    await s.apply(HERZII, [cmd(0, { kind: "walk.start", walkKey: "w2" })]); // tapped first, sent later
    expect((await s.current()).walk).toMatchObject({ key: "w1", startedAt: at(0), walkers: [HIRSCH, HERZII] });
  });

  test("pauses count only inside the walk, also after its end was edited", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(30, { kind: "walk.pause", walkKey: "w" }), cmd(40, { kind: "walk.resume", walkKey: "w" }), cmd(50, { kind: "walk.stop", walkKey: "w" })]);
    const walk = (await entries())[0];
    await new EntryRepository(db()).update(walk.id, { at: walk.at, endedAt: at(35), amountG: null, foodKind: null, unitG: null, note: null });
    expect(await s.summary(walk.id)).toMatchObject({ totalMin: 35, pauseMin: 5 });
  });

  test("applied ids older than 30 days are forgotten", async () => {
    const old = new Sessions({ db: db(), names, now: () => new Date("2026-09-01T12:00:00Z") });
    await old.apply(HIRSCH, [cmd("2026-09-01T09:00:00.000Z", { id: "old", kind: "log", type: "pee", dogId: 1 })]);
    await sessions().apply(HIRSCH, [cmd(0, { kind: "log", type: "poop", dogId: 1 })]);
    const ids = (await db().selectFrom("applied_command").select("id").execute()).map((r) => r.id);
    expect(ids).not.toContain("old");
    expect(ids).toHaveLength(1);
  });

  test("join adds a walker once", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" })]);
    await s.apply(HERZII, [cmd(3, { kind: "walk.join", walkKey: "w" }), cmd(4, { kind: "walk.join", walkKey: "w" })]);
    await s.apply(HIRSCH, [cmd(5, { kind: "walk.join", walkKey: "w" })]);
    expect((await s.current()).walk!.walkers).toEqual([HIRSCH, HERZII]);
  });

  test("anyone on the walk can stop it", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" })]);
    await s.apply(HERZII, [cmd(3, { kind: "walk.join", walkKey: "w" }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    expect((await entries())[0]).toMatchObject({ endedAt: at(30) });
  });

  test("stop closes an open pause and training", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [
      cmd(0, { kind: "walk.start", walkKey: "w" }),
      cmd(10, { kind: "training.start", trainingKey: "t", walkKey: "w" }),
      cmd(20, { kind: "walk.pause", walkKey: "w" }),
      cmd(30, { kind: "walk.stop", walkKey: "w" }),
    ]);
    const all = await entries();
    expect(all.find((e) => e.type === "training")).toMatchObject({ at: at(10), endedAt: at(30) });
    const walk = all.find((e) => e.type === "walk")!;
    expect(await s.summary(walk.id)).toMatchObject({ totalMin: 30, pauseMin: 10, trainings: [{ min: 20, exercises: [], treats: [] }] });
  });

  test("late pause after stop is dropped", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    const pause = cmd(35, { kind: "walk.pause", walkKey: "w" });
    const training = cmd(36, { kind: "training.start", trainingKey: "t", walkKey: "w" });
    expect(await s.apply(HERZII, [pause, training])).toEqual({ applied: [], dropped: [pause.id, training.id] });
    const walk = (await entries())[0];
    expect(await s.summary(walk.id)).toMatchObject({ totalMin: 30, pauseMin: 0, trainings: [] });
    expect(await entries()).toHaveLength(1);
  });

  test("a pause that happened before the stop but arrives after it still counts", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    await s.apply(HERZII, [cmd(10, { kind: "walk.pause", walkKey: "w" }), cmd(15, { kind: "walk.resume", walkKey: "w" }), cmd(25, { kind: "walk.pause", walkKey: "w" })]);
    const walk = (await entries())[0];
    expect(await s.summary(walk.id)).toMatchObject({ totalMin: 30, pauseMin: 10 }); // 5 min, then 25→30 closed by the stop
  });

  test("late pipi after stop is a plain entry", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    const pipi = cmd(40, { kind: "log", type: "pee", dogId: 1 });
    expect(await s.apply(HERZII, [pipi])).toEqual({ applied: [pipi.id], dropped: [] });
    const all = await entries();
    expect(all[0]).toMatchObject({ type: "pee", at: at(40), loggedBy: "bille" });
    expect(await s.summary(all[1].id)).toMatchObject({ pee: 0 });
  });

  test("applying a command id twice changes nothing", async () => {
    const s = sessions();
    const start = cmd(0, { kind: "walk.start", walkKey: "w" });
    const pipi = cmd(5, { kind: "log", type: "pee", dogId: 1 });
    const treat = cmd(6, { kind: "log", type: "poop", dogId: 1 });
    await s.apply(HIRSCH, [start, pipi, treat]);
    const before = await entries();
    expect(await s.apply(HIRSCH, [start, pipi, treat])).toEqual({ applied: [start.id, pipi.id, treat.id], dropped: [] });
    expect(await entries()).toEqual(before);
  });

  test("commands are applied in time order, not arrival order", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(52, { kind: "walk.stop", walkKey: "w" }), cmd(30, { kind: "walk.resume", walkKey: "w" }), cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(20, { kind: "walk.pause", walkKey: "w" })]);
    const walk = (await entries())[0];
    expect(await s.summary(walk.id)).toMatchObject({ totalMin: 52, pauseMin: 10 });
  });

  test("a stop for a walk nobody started is dropped", async () => {
    const stop = cmd(10, { kind: "walk.stop", walkKey: "nope" });
    expect(await sessions().apply(HIRSCH, [stop])).toEqual({ applied: [], dropped: [stop.id] });
  });

  test("summary counts pee/poop inside the walk's time only", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [
      cmd(0, { kind: "log", type: "pee", dogId: 1 }),
      cmd(1, { kind: "walk.start", walkKey: "w" }),
      cmd(5, { kind: "log", type: "pee", dogId: 1 }),
      cmd(6, { kind: "log", type: "poop", dogId: 1 }),
      cmd(7, { kind: "log", type: "pee", dogId: 1 }),
      cmd(30, { kind: "walk.stop", walkKey: "w" }),
      cmd(31, { kind: "log", type: "poop", dogId: 1 }),
    ]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect(await s.summary(walk.id)).toMatchObject({ pee: 2, poop: 1 });
  });
});

describe("dogs", () => {
  const addDog = async (name: string, archived = false) =>
    (await db().insertInto("dog").values({ name, color: "#3a6fc0", archived: archived ? 1 : 0, created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow()).id;

  test("a walk without dogIds takes all active dogs; with dogIds just those", async () => {
    const bruno = await addDog("Bruno");
    await addDog("Alt", true);
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w1" })]);
    expect((await s.current()).walk!.dogIds).toEqual([1, bruno]);
    await s.apply(HIRSCH, [cmd(30, { kind: "walk.stop", walkKey: "w1" }), cmd(40, { kind: "walk.start", walkKey: "w2", dogIds: [bruno] })]);
    expect((await s.current()).walk!.dogIds).toEqual([bruno]);
  });

  test("a log with an unknown or archived dog is dropped", async () => {
    const old = await addDog("Alt", true);
    const unknown = cmd(1, { kind: "log", type: "pee", dogId: 999 });
    const archived = cmd(2, { kind: "log", type: "pee", dogId: old });
    const fine = cmd(3, { kind: "log", type: "poop", dogId: 1 });
    expect(await sessions().apply(HIRSCH, [unknown, archived, fine])).toEqual({ applied: [fine.id], dropped: [unknown.id, archived.id] });
    expect((await entries()).map((e) => [e.type, e.dogIds])).toEqual([["poop", [1]]]);
  });

  test("unknown dogs in a start are left out; if none is left, all active dogs come", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "training.start", trainingKey: "t", dogIds: [999] })]);
    expect((await s.current()).training!.dogIds).toEqual([1]);
  });
});

describe("trainings", () => {
  test("training at home has no walkKey", async () => {
    const s = sessions();
    await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t" })]);
    expect((await s.current()).training).toEqual({ key: "t", startedAt: at(0), dogIds: [1], walkKey: null, exercises: [], treats: {} });
    await s.apply(HERZII, [cmd(12, { kind: "training.stop", trainingKey: "t" })]);
    expect(await s.current()).toEqual({ walk: null, training: null });
    expect((await entries())[0]).toMatchObject({ type: "training", durationMin: 12, loggedBy: "bille" });
  });

  test("training on a walk knows its walk", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(5, { kind: "training.start", trainingKey: "t", walkKey: "w" })]);
    expect((await s.current()).training).toMatchObject({ key: "t", walkKey: "w" });
  });

  test("exercise toggles and treat counts never go below 0", async () => {
    const c = new Catalog(db());
    const sitz = await c.addExercise("Sitz");
    const bleib = await c.addExercise("Bleib");
    const kaese = await c.addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HERZII, [
      cmd(0, { kind: "training.start", trainingKey: "t" }),
      cmd(1, { kind: "training.exercise", trainingKey: "t", exerciseId: sitz.id, on: true }),
      cmd(2, { kind: "training.exercise", trainingKey: "t", exerciseId: bleib.id, on: true }),
      cmd(3, { kind: "training.exercise", trainingKey: "t", exerciseId: bleib.id, on: false }),
      cmd(4, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(5, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: -1 }),
      cmd(6, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: -1 }),
      cmd(7, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
    ]);
    expect((await s.current()).training).toMatchObject({ exercises: [sitz.id], treats: { [kaese.id]: 1 } });
  });

  test("a walk's summary lists its trainings with exercises and treats", async () => {
    const c = new Catalog(db());
    const sitz = await c.addExercise("Sitz");
    const kaese = await c.addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HIRSCH, [
      cmd(0, { kind: "walk.start", walkKey: "w" }),
      cmd(10, { kind: "training.start", trainingKey: "t", walkKey: "w" }),
      cmd(11, { kind: "training.exercise", trainingKey: "t", exerciseId: sitz.id, on: true }),
      cmd(12, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(13, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(16, { kind: "training.stop", trainingKey: "t" }),
      cmd(40, { kind: "walk.stop", walkKey: "w" }),
    ]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect((await s.summary(walk.id)).trainings).toEqual([{ min: 6, exercises: ["Sitz"], treats: [{ name: "Käse", count: 2 }] }]);
  });

  test("a treat tap after the training ended is dropped", async () => {
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t" }), cmd(10, { kind: "training.stop", trainingKey: "t" })]);
    const late = cmd(11, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 });
    expect(await s.apply(HERZII, [late])).toEqual({ applied: [], dropped: [late.id] });
  });
});
