import { describe, expect, test } from "vitest";
import type { Command } from "@gassi/domain";
import { Catalog } from "./catalog";
import { freshDatabase } from "./db/testing";
import { DogRepository } from "./dogs";
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
    expect(await s.summaryFor("w2")).toMatchObject({ totalMin: 40, walkers: [HIRSCH, HERZII], pees: [{ at: at(5), dogId: 1 }] });
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
    expect(await s.summary(all[1].id)).toMatchObject({ pees: [] });
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

  test("summary lists pee/poop inside the walk's time only, with times and dogs, oldest first", async () => {
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
    expect(await s.summary(walk.id)).toMatchObject({ pees: [{ at: at(5), dogId: 1 }, { at: at(7), dogId: 1 }], poops: [{ at: at(6), dogId: 1 }] });
    // each with its entry's id, so the summary can open it
    const idAt = async (type: string, t: string) => (await entries()).find((e) => e.type === type && e.at === t)!.id;
    expect((await s.summary(walk.id)).pees.map((m) => m.id)).toEqual([await idAt("pee", at(5)), await idAt("pee", at(7))]);
    expect((await s.summary(walk.id)).poops[0].id).toBe(await idAt("poop", at(6)));
  });

  test("a marking is its own kind on the walk, not a pee", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(3, { kind: "log", type: "mark", dogId: 1 }), cmd(4, { kind: "log", type: "mark", dogId: 1 }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect(await s.summary(walk.id)).toMatchObject({ pees: [], marks: [{ at: at(3) }, { at: at(4) }] });
  });

  test("a consistency lands on the poop of its dog and time, changes and clears; without that poop it is dropped", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(6, { kind: "log", type: "poop", dogId: 1 }), cmd(7, { kind: "log.consistency", poopAt: at(6), dogId: 1, consistency: "soft" })]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect((await s.summary(walk.id)).poops).toMatchObject([{ at: at(6), consistency: "soft" }]);
    await s.apply(HIRSCH, [cmd(8, { kind: "log.consistency", poopAt: at(6), dogId: 1, consistency: "liquid" })]);
    expect((await entries()).find((e) => e.type === "poop")!.details).toEqual({ consistency: "liquid" });
    await s.apply(HIRSCH, [cmd(9, { kind: "log.consistency", poopAt: at(6), dogId: 1, consistency: null })]);
    expect((await entries()).find((e) => e.type === "poop")!.details).toBeNull();
    expect(await s.apply(HIRSCH, [cmd(10, { id: "nope", kind: "log.consistency", poopAt: at(5), dogId: 1, consistency: "hard" })])).toEqual({ applied: [], dropped: ["nope"] });
  });
});

describe("notes and encounters", () => {
  test("logged as commands, at home or on a walk, where the summary lists them; what doesn't fit is dropped", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [
      cmd(0, { kind: "walk.start", walkKey: "w" }),
      cmd(5, { kind: "log.entry", type: "dogEncounter", dogId: 1, details: { reaction: 2, handling: "wideBerth" } }),
      cmd(6, { kind: "log.entry", type: "note", note: "Matsch am Bach" }),
      cmd(30, { kind: "walk.stop", walkKey: "w" }),
      cmd(40, { kind: "log.entry", type: "personEncounter", dogId: 1, details: { who: "Oma Inge", rating: 8, place: "home" } }),
    ]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect((await s.summary(walk.id)).logged).toMatchObject([
      { at: at(5), type: "dogEncounter", dogId: 1, details: { reaction: 2, handling: "wideBerth" } },
      { at: at(6), type: "note", dogId: null, note: "Matsch am Bach" },
    ]);
    expect((await entries()).find((e) => e.type === "personEncounter")).toMatchObject({ dogIds: [1], details: { who: "Oma Inge", rating: 8 } });
    const bad = [cmd(41, { id: "no-reaction", kind: "log.entry", type: "dogEncounter", dogId: 1, details: {} }), cmd(42, { id: "no-dog", kind: "log.entry", type: "personEncounter", details: { who: "X", rating: 1 } })];
    expect(await s.apply(HIRSCH, bad)).toEqual({ applied: [], dropped: ["no-reaction", "no-dog"] });
  });
});

describe("commands and treats without a training (#36)", () => {
  test("a command is an entry with its repetition and treat; a treat alone too; an unknown exercise is dropped whole", async () => {
    const s = sessions();
    const catalog = new Catalog(db());
    const warten = await catalog.addExercise("Warten");
    const kaese = await catalog.addTreatKind({ name: "Käse", gramsPerPiece: 2, fromDry: false });
    await s.apply(HIRSCH, [
      cmd(1, { kind: "quick.command", dogId: 1, exerciseId: warten.id, ok: true, treatKindId: kaese.id }),
      cmd(2, { kind: "quick.command", dogId: 1, exerciseId: warten.id, ok: false }),
      cmd(3, { kind: "quick.treat", dogId: 1, treatKindId: kaese.id }),
    ]);
    const all = await entries();
    expect(all.map((e) => e.type)).toEqual(["treat", "command", "command"]);
    const reps = await db().selectFrom("training_exercise").select(["entry_id", "ok_count", "fail_count"]).orderBy("entry_id").execute();
    expect(reps.map((r) => [r.ok_count, r.fail_count])).toEqual([[1, 0], [0, 1]]);
    expect((await db().selectFrom("training_treat").select("count").execute()).map((r) => r.count)).toEqual([1, 1]);
    expect(await s.apply(HIRSCH, [cmd(4, { id: "gone", kind: "quick.command", dogId: 1, exerciseId: 999, ok: true })])).toEqual({ applied: [], dropped: ["gone"] });
    expect(await entries()).toHaveLength(3);
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
    expect((await s.current()).training).toEqual({ key: "t", startedAt: at(0), dogIds: [1], walkKey: null, reps: [], treats: {} });
    await s.apply(HERZII, [cmd(12, { kind: "training.stop", trainingKey: "t" })]);
    expect(await s.current()).toEqual({ walk: null, training: null });
    expect((await entries())[0]).toMatchObject({ type: "training", durationMin: 12, loggedBy: "bille" });
  });

  test("training on a walk knows its walk", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" }), cmd(5, { kind: "training.start", trainingKey: "t", walkKey: "w" })]);
    expect((await s.current()).training).toMatchObject({ key: "t", walkKey: "w" });
  });

  test("treat counts never go below 0", async () => {
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HERZII, [
      cmd(0, { kind: "training.start", trainingKey: "t" }),
      cmd(4, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(5, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: -1 }),
      cmd(6, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: -1 }),
      cmd(7, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
    ]);
    expect((await s.current()).training).toMatchObject({ treats: { [kaese.id]: 1 } });
  });

  const rep = (t: number, exerciseId: number, dogId: number, ok: boolean, delta: 1 | -1 = 1) => cmd(t, { kind: "training.rep", trainingKey: "t", exerciseId, dogId, ok, delta });

  test("reps are stored per exercise and dog and never go below 0", async () => {
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const bruno = await db().insertInto("dog").values({ name: "Bruno", color: "#3a6fc0", archived: 0, created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow();
    const s = sessions();
    await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t", dogIds: [1, bruno.id] }), rep(1, sitz.id, 1, true), rep(2, sitz.id, 1, true), rep(3, sitz.id, 1, false), rep(4, sitz.id, bruno.id, true), rep(5, sitz.id, bruno.id, false, -1)]);
    expect((await s.current()).training!.reps).toEqual([
      { exerciseId: sitz.id, dogId: 1, ok: 2, fail: 1 },
      { exerciseId: sitz.id, dogId: bruno.id, ok: 1, fail: 0 },
    ]);
  });

  test("a rep for a dog not in the training is dropped", async () => {
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const s = sessions();
    const bruno = await db().insertInto("dog").values({ name: "Bruno", color: "#3a6fc0", archived: 0, created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow();
    const [foreign, unknown] = [rep(1, sitz.id, bruno.id, true), rep(2, sitz.id, 999, true)];
    const result = await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t", dogIds: [1] }), foreign, unknown]);
    expect((await s.current()).training!.reps).toEqual([]);
    expect(result.dropped).toEqual([foreign.id, unknown.id]);
  });

  test("a rep for an unknown exercise is dropped", async () => {
    const s = sessions();
    const unknown = rep(1, 999, 1, true);
    const result = await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t" }), unknown]);
    expect(result.dropped).toEqual([unknown.id]);
    expect((await s.current()).training!.reps).toEqual([]);
  });

  test("resending the same rep command id changes nothing", async () => {
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const s = sessions();
    const r = rep(1, sitz.id, 1, true);
    await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t" }), r]);
    await s.apply(HERZII, [r]);
    expect((await s.current()).training!.reps).toEqual([{ exerciseId: sitz.id, dogId: 1, ok: 1, fail: 0 }]);
  });

  test("a walk's summary lists its trainings with their start, exercises and treats", async () => {
    const c = new Catalog(db());
    const sitz = await c.addExercise("Sitz");
    const kaese = await c.addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HIRSCH, [
      cmd(0, { kind: "walk.start", walkKey: "w" }),
      cmd(10, { kind: "training.start", trainingKey: "t", walkKey: "w" }),
      rep(11, sitz.id, 1, true),
      rep(11, sitz.id, 1, true),
      rep(11, sitz.id, 1, false),
      cmd(12, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(13, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 }),
      cmd(16, { kind: "training.stop", trainingKey: "t" }),
      cmd(40, { kind: "walk.stop", walkKey: "w" }),
    ]);
    const walk = (await entries()).find((e) => e.type === "walk")!;
    expect((await s.summary(walk.id)).trainings).toEqual([{ id: expect.any(Number), startedAt: at(10), min: 6, exercises: [{ name: "Sitz", ok: 2, fail: 1 }], treats: [{ name: "Käse", count: 2 }] }]);
  });

  test("a treat tap after the training ended is dropped", async () => {
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    const s = sessions();
    await s.apply(HERZII, [cmd(0, { kind: "training.start", trainingKey: "t" }), cmd(10, { kind: "training.stop", trainingKey: "t" })]);
    const late = cmd(11, { kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 });
    expect(await s.apply(HERZII, [late])).toEqual({ applied: [], dropped: [late.id] });
  });
});

describe("food", () => {
  test("a food command creates one food entry, also when sent twice", async () => {
    const s = sessions();
    const food = cmd(5, { kind: "food", amountG: 80, foodKind: "wet" });
    await s.apply(HIRSCH, [food]);
    expect(await s.apply(HIRSCH, [food])).toEqual({ applied: [food.id], dropped: [] });
    const all = (await new EntryRepository(db()).list({ type: "food" }));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ type: "food", at: at(5), amountG: 80, foodKind: "wet", loggedBy: "marcel" });
    const active = (await new DogRepository(db()).activeIds()).sort();
    expect([...all[0].dogIds].sort()).toEqual(active);
  });

  test("a can opened is one wet entry of one can, for no dog, also when sent twice", async () => {
    const s = sessions();
    const open = cmd(6, { kind: "can.open", unitG: 400 });
    await s.apply(HIRSCH, [open]);
    expect(await s.apply(HIRSCH, [open])).toEqual({ applied: [open.id], dropped: [] });
    const all = await new EntryRepository(db()).list({ type: "opened" });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ type: "opened", at: at(6), foodKind: "wet", unitG: 400, amountG: 400, dogIds: [], loggedBy: "marcel" });
  });
});

describe("changing walkers and dogs", () => {
  const addDog = async (name: string, archived = false) =>
    (await db().insertInto("dog").values({ name, color: "#3a6fc0", archived: archived ? 1 : 0, created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow()).id;

  test("any walker adds another household member and removes them again", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" })]);
    const add = cmd(1, { kind: "walk.walker", walkKey: "w", personId: "bille", on: true });
    expect(await s.apply(HIRSCH, [add])).toEqual({ applied: [add.id], dropped: [] });
    expect(await s.apply(HIRSCH, [add])).toEqual({ applied: [add.id], dropped: [] }); // a resend is harmless
    expect((await s.current()).walk!.walkers).toEqual([HIRSCH, HERZII]);
    await s.apply(HERZII, [cmd(2, { kind: "walk.walker", walkKey: "w", personId: "marcel", on: false })]);
    expect((await s.current()).walk!.walkers).toEqual([HERZII]);
  });

  test("the only walker cannot be removed, an unknown person cannot be added", async () => {
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w" })]);
    const last = cmd(1, { kind: "walk.walker", walkKey: "w", personId: "marcel", on: false });
    const unknown = cmd(2, { kind: "walk.walker", walkKey: "w", personId: "nobody", on: true });
    expect(await s.apply(HIRSCH, [last, unknown])).toEqual({ applied: [], dropped: [last.id, unknown.id] });
    expect((await s.current()).walk!.walkers).toEqual([HIRSCH]);
  });

  test("a dog is added and removed on a running walk; trainings stay as they are", async () => {
    const bruno = await addDog("Bruno");
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w", dogIds: [1] }), cmd(1, { kind: "training.start", trainingKey: "t", walkKey: "w", dogIds: [1] })]);
    await s.apply(HIRSCH, [cmd(2, { kind: "walk.dog", walkKey: "w", dogId: bruno, on: true }), cmd(3, { kind: "walk.dog", walkKey: "w", dogId: bruno, on: true })]);
    expect((await s.current()).walk!.dogIds).toEqual([1, bruno]);
    await s.apply(HIRSCH, [cmd(4, { kind: "walk.dog", walkKey: "w", dogId: 1, on: false })]);
    const view = await s.current();
    expect(view.walk!.dogIds).toEqual([bruno]);
    expect(view.training!.dogIds).toEqual([1]);
  });

  test("the only dog cannot be removed, an archived or unknown dog cannot be added", async () => {
    const old = await addDog("Alt", true);
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w", dogIds: [1] })]);
    const last = cmd(1, { kind: "walk.dog", walkKey: "w", dogId: 1, on: false });
    const archived = cmd(2, { kind: "walk.dog", walkKey: "w", dogId: old, on: true });
    const unknown = cmd(3, { kind: "walk.dog", walkKey: "w", dogId: 999, on: true });
    expect(await s.apply(HIRSCH, [last, archived, unknown])).toEqual({ applied: [], dropped: [last.id, archived.id, unknown.id] });
    expect((await s.current()).walk!.dogIds).toEqual([1]);
  });

  test("a change at or after the end of the walk is dropped", async () => {
    const bruno = await addDog("Bruno");
    const s = sessions();
    await s.apply(HIRSCH, [cmd(0, { kind: "walk.start", walkKey: "w", dogIds: [1] }), cmd(30, { kind: "walk.stop", walkKey: "w" })]);
    const walker = cmd(30, { kind: "walk.walker", walkKey: "w", personId: "bille", on: true });
    const dog = cmd(31, { kind: "walk.dog", walkKey: "w", dogId: bruno, on: true });
    expect(await s.apply(HIRSCH, [walker, dog])).toEqual({ applied: [], dropped: [walker.id, dog.id] });
  });
});
