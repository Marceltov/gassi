import { describe, expect, test } from "vitest";
import { freshDatabase } from "./db/testing";
import { Diary, HISTORY_PAGE, InputError } from "./diary";
import { Catalog } from "./catalog";
import { Sessions } from "./sessions";

const { db } = freshDatabase();
const HIRSCH = { id: "marcel", name: "Hirsch" };
const HERZII = { id: "bille", name: "Herzii" };
let clock = new Date("2026-10-20T10:00:00Z");
const diary = () => new Diary({ db: db(), names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), timeZone: "Europe/Berlin", now: () => clock });

describe("log", () => {
  test("logs for the signed-in user and shows their display name", async () => {
    const e = await diary().log(HIRSCH, { type: "food", foodKind: "wet", at: "2026-10-20T09:00:00Z", amountG: "200", note: "  " });
    expect(e).toMatchObject({ type: "food", at: "2026-10-20T09:00:00.000Z", amountG: 200, note: null, loggedBy: "marcel", byName: "Hirsch" });
  });

  test.each([
    [{ type: "walk", at: "gestern" }, "Die Zeit fehlt oder stimmt nicht."],
    [{ type: "walk", at: "2026-10-20T09:00:00Z", endedAt: "2026-10-20T08:00:00Z" }, /Ende/],
    [{ type: "food", at: "2026-10-20T09:00:00Z", foodKind: "canned" }, /Futterart/],
    [{ type: "food", foodKind: "wet", at: "2026-10-20T09:00:00Z", amountG: -1 }, /Menge/],
    [{ type: "food", at: "2026-10-20T09:00:00Z", amountG: 200 }, /Welche Futterart/],
    [{ type: "restock", at: "2026-10-20T09:00:00Z", amountG: 200 }, /Welche Futterart/],
    [{ type: "bark", at: "2026-10-20T09:00:00Z" }, /Art/],
  ])("rejects %j", async (input, message) => {
    await expect(diary().log(HIRSCH, input)).rejects.toBeInstanceOf(InputError);
    await expect(diary().log(HIRSCH, input)).rejects.toThrow(message);
  });

});

test("edit changes the fields, remove deletes", async () => {
  const d = diary();
  const e = await d.log(HIRSCH, { type: "walk", at: "2026-10-20T09:00:00Z" });
  expect(await d.edit(e.id, { at: "2026-10-20T08:00:00Z", endedAt: "2026-10-20T08:40:00Z" })).toMatchObject({ at: "2026-10-20T08:00:00.000Z", durationMin: 40 });
  expect(await d.edit(999, { at: "2026-10-20T08:00:00Z" })).toBeNull();
  expect(await d.remove(e.id)).toBe(true);
  expect(await d.all()).toEqual([]);
});

test("history pages by 50 and says when there is more", async () => {
  const d = diary();
  for (let i = 0; i < HISTORY_PAGE + 1; i++) await d.log(HIRSCH, { type: "walk", at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() });
  await d.log(HERZII, { type: "food", foodKind: "dry", at: "2026-10-02T00:00:00Z" });
  const first = await d.history({});
  expect(first.entries).toHaveLength(HISTORY_PAGE);
  expect(first.more).toBe(true);
  const second = await d.history({}, HISTORY_PAGE);
  expect(second.entries).toHaveLength(2);
  expect(second.more).toBe(false);
  expect((await d.history({ by: "bille" })).entries).toHaveLength(1);
  expect((await d.history({ type: "food" })).entries[0].byName).toBe("Herzii");
});

test("the person filter also finds walks the person went on but didn't log", async () => {
  const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
  await s.apply(HIRSCH, [{ id: "1", at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: "w" }]);
  await s.apply(HERZII, [{ id: "2", at: "2026-10-20T09:01:00.000Z", kind: "walk.join", walkKey: "w" }]);
  await diary().log(HIRSCH, { type: "food", foodKind: "dry", at: "2026-10-20T08:00:00Z" });
  const walk = (await diary().history({ type: "walk" })).entries[0];
  expect((await diary().history({ by: "bille" })).entries.map((e) => e.id)).toEqual([walk.id]);
  expect((await diary().history({ by: "marcel" })).entries).toHaveLength(2);
  expect((await diary().history({ by: "bille", type: "walk" })).entries).toHaveLength(1);
});

test("filter keeps only known types and people", () => {
  const d = diary();
  expect(d.filter({ type: "walk", by: "marcel" })).toEqual({ type: "walk", by: "marcel" });
  expect(d.filter({ type: "bark", by: "mallory" })).toEqual({});
  expect(d.filter({ type: ["walk"], by: 1 })).toEqual({});
});


describe("food and stock", () => {
  test("suggests the last amount per food kind", async () => {
    const d = diary();
    expect(await d.lastFoodAmounts()).toEqual({ wet: null, dry: null, wetUnitG: null });
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 200, unitG: 800, at: "2026-10-20T07:00:00Z" });
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 180, at: "2026-10-20T08:00:00Z" });
    await d.log(HIRSCH, { type: "food", foodKind: "dry", amountG: 80, at: "2026-10-20T08:30:00Z" });
    // the size of the newest wet feeding that named one
    expect(await d.lastFoodAmounts()).toEqual({ wet: 180, dry: 80, wetUnitG: 800 });
  });

  test("restocks: cans × grams per can for wet food, g or kg for dry food", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    const wet = await d.restock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 12 }, { unitG: 800, cans: 0 }, { unitG: 200, cans: 2 }] });
    expect(wet.entries).toMatchObject([
      { type: "restock", foodKind: "wet", amountG: 4800, unitG: 400, at: clock.toISOString() },
      { type: "restock", foodKind: "wet", amountG: 400, unitG: 200, at: clock.toISOString() },
    ]);
    await d.remove(wet.entries[1].id); // a purchase's sizes stay apart: only that one goes
    expect((await d.restock(HIRSCH, { foodKind: "dry", amount: "7,5", unit: "kg" })).entries).toMatchObject([{ type: "restock", foodKind: "dry", amountG: 7500, unitG: null }]);
    expect((await d.restock(HIRSCH, { foodKind: "dry", amount: 2500, unit: "g" })).entries).toMatchObject([{ amountG: 2500 }]);
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T10:30:00Z" });
    clock = new Date("2026-10-20T11:00:00Z");
    expect((await d.stock()).wet).toMatchObject({ grams: 4600, sizes: [{ unitG: 400, cans: 11.5 }] });
  });

  test("a restock needs cans of some size, or an amount", async () => {
    await expect(diary().restock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 0 }] })).rejects.toThrow(new InputError("Wie viele Dosen welcher Größe hast du gekauft?"));
    await expect(diary().restock(HIRSCH, { foodKind: "dry", amount: 0, unit: "kg" })).rejects.toThrow(new InputError("Wie viel hast du gekauft?"));
    await expect(diary().restock(HIRSCH, { foodKind: "canned", grams: 10 })).rejects.toThrow(InputError);
  });

  test("correcting the stock: wet in cans per size (every size at once, no purchase needed), dry in g or kg", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    const first = await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: "2,5" }] });
    expect(first.entries).toMatchObject([{ type: "stockcheck", foodKind: "wet", amountG: 1000, unitG: 400 }]);
    await d.restock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 800, cans: 2 }] });
    clock = new Date("2026-10-20T10:05:00Z");
    const both = await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 5 }, { unitG: 800, cans: 1 }] });
    expect(both.entries.map((e) => [e.amountG, e.unitG, e.at])).toEqual([[2000, 400, clock.toISOString()], [800, 800, clock.toISOString()]]);
    expect((await d.correctStock(HIRSCH, { foodKind: "dry", amount: "0", unit: "kg" })).entries).toMatchObject([{ type: "stockcheck", foodKind: "dry", amountG: 0, unitG: null }]);
    clock = new Date("2026-10-20T10:10:00Z");
    const stock = await d.stock();
    expect(stock.wet.sizes.map((s) => [s.unitG, s.cans])).toEqual([[400, 5], [800, 1]]);
    expect(stock).toMatchObject({ wet: { grams: 2800 }, dry: { grams: 0 } });
    // a size left out of a count is 0, and no longer offered
    clock = new Date("2026-10-20T10:15:00Z");
    await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 800, cans: 2 }] });
    expect((await d.stock()).wet.sizes.map((s) => [s.unitG, s.cans])).toEqual([[800, 2]]);
  });
});

describe("a wet count is one thing", () => {
  const twoSizes = async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    const { entries } = await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 3 }, { unitG: 800, cans: 1 }] });
    clock = new Date("2026-10-20T12:00:00Z");
    return { d, entries };
  };
  const counts = async (d: ReturnType<typeof diary>) => (await d.stock()).wet.sizes.map((s) => [s.unitG, s.cans]);

  test("its rows show the whole count", async () => {
    const { d, entries } = await twoSizes();
    expect((await d.get(entries[1].id))?.count).toEqual([{ unitG: 400, amountG: 1200 }, { unitG: 800, amountG: 800 }]);
    expect((await d.get(entries[0].id))?.count).toHaveLength(2);
  });

  test("moving one row's time moves the whole count: the other size keeps its count", async () => {
    const { d, entries } = await twoSizes();
    await d.edit(entries[0].id, { at: "2026-10-20T09:00:00Z", amountG: 1200, foodKind: "wet", unitG: 400 });
    expect((await d.get(entries[1].id))?.at).toBe("2026-10-20T09:00:00.000Z");
    expect(await counts(d)).toEqual([[400, 3], [800, 1]]);
    await d.edit(entries[1].id, { at: "2026-10-20T11:00:00Z", amountG: 800, foodKind: "wet", unitG: 800 });
    expect(await counts(d)).toEqual([[400, 3], [800, 1]]);
  });

  test("a count can't be moved onto another count's time", async () => {
    const { d, entries } = await twoSizes();
    const other = (await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 9 }] })).entries[0];
    await expect(d.edit(entries[0].id, { at: other.at, amountG: 1200, foodKind: "wet", unitG: 400 })).rejects.toThrow(new InputError("Zu dieser Zeit gibt es schon eine Zählung."));
    expect((await d.get(entries[1].id))?.at).toBe(entries[1].at); // nothing moved
    expect((await d.edit(entries[0].id, { at: entries[0].at, amountG: 1200, foodKind: "wet", unitG: 400, note: "gleiche Zeit" }))?.note).toBe("gleiche Zeit"); // its own time is fine
  });

  test("deleting one row deletes the whole count", async () => {
    const { d, entries } = await twoSizes();
    expect(await d.remove(entries[0].id)).toBe(true);
    expect(await d.get(entries[1].id)).toBeNull();
    expect((await d.stock()).wet.grams).toBeNull();
  });

  test("other entries keep their own time and go alone", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    const dry = (await d.correctStock(HIRSCH, { foodKind: "dry", amount: 500 })).entries[0];
    const wet = (await d.correctStock(HIRSCH, { foodKind: "wet", sizes: [{ unitG: 400, cans: 1 }] })).entries[0];
    expect((await d.get(dry.id))?.count).toBeNull();
    await d.remove(dry.id);
    expect(await d.get(wet.id)).not.toBeNull();
  });
});

describe("weight", () => {
  test("is logged in kg with one decimal and stored in grams", async () => {
    expect(await diary().logWeight(HIRSCH, { kg: "12,4", at: "2026-10-03T08:00:00Z" })).toMatchObject({ type: "weight", amountG: 12_400, at: "2026-10-03T08:00:00.000Z" });
    expect(await diary().logWeight(HIRSCH, { kg: 12.46, at: "2026-10-04T08:00:00Z" })).toMatchObject({ amountG: 12_500 });
  });

  test("stays between 0.5 and 100 kg", async () => {
    await expect(diary().logWeight(HIRSCH, { kg: "0,4", at: "2026-10-03T08:00:00Z" })).rejects.toThrow(new InputError("Das Gewicht muss zwischen 0,5 und 100 kg liegen."));
    await expect(diary().logWeight(HIRSCH, { kg: "", at: "2026-10-03T08:00:00Z" })).rejects.toThrow(InputError);
  });
});

describe("day filter and week", () => {
  test("the history filter takes a day and lists only that day in Berlin", async () => {
    const d = diary();
    expect(d.filter({ day: "2026-10-20" })).toEqual({ day: "2026-10-20" });
    expect(d.filter({ day: "20.10.2026" })).toEqual({});
    await d.log(HIRSCH, { type: "pee", at: "2026-10-19T21:59:00Z" }); // 23:59 on the 19th
    const inside = await d.log(HIRSCH, { type: "pee", at: "2026-10-19T22:00:00Z" }); // 00:00 on the 20th
    await d.log(HIRSCH, { type: "pee", at: "2026-10-20T22:00:00Z" }); // 00:00 on the 21st
    expect((await d.history({ day: "2026-10-20" })).entries.map((e) => e.id)).toEqual([inside.id]);
  });

  test("the week has the walkers of joint walks and what trainings practised", async () => {
    clock = new Date("2026-10-22T12:00:00Z");
    const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    await s.apply(HIRSCH, [{ id: "1", at: "2026-10-21T08:00:00.000Z", kind: "walk.start", walkKey: "w" }]);
    await s.apply({ id: "bille", name: "Herzii" }, [
      { id: "2", at: "2026-10-21T08:01:00.000Z", kind: "walk.join", walkKey: "w" },
      { id: "3", at: "2026-10-21T08:10:00.000Z", kind: "training.start", trainingKey: "t", walkKey: "w" },
      { id: "4", at: "2026-10-21T08:11:00.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: true, delta: 1 },
      { id: "5", at: "2026-10-21T08:12:00.000Z", kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 },
      { id: "6", at: "2026-10-21T08:40:00.000Z", kind: "walk.stop", walkKey: "w" },
    ]);
    const w = await diary().week("2026-10-19");
    expect(w.monday).toBe("2026-10-19");
    expect(w.byPerson).toMatchObject([
      { id: "bille", walks: 1, walkMin: 40, trainings: 1, ok: 1 },
      { id: "marcel", walks: 1, walkMin: 40, trainings: 0, ok: 0 },
    ]);
    expect(w.exercises).toEqual([{ name: "Sitz", ok: 1, fail: 0 }]);
    expect(w.routes).toEqual([]);
    expect(w.treats).toBe(1);
    expect((await diary().week("bogus")).monday).toBe("2026-10-19"); // this week
    expect((await diary().week("2026-10-21")).monday).toBe("2026-10-19"); // any day → its Monday
  });
});

describe("entries carry their walk and training details", () => {
  test("walkers and pause of a walk, exercises and treats of a training", async () => {
    clock = new Date("2026-10-20T12:00:00Z");
    const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    await s.apply(HIRSCH, [
      { id: "1", at: "2026-10-20T08:00:00.000Z", kind: "walk.start", walkKey: "w" },
      { id: "2", at: "2026-10-20T08:10:00.000Z", kind: "walk.pause", walkKey: "w" },
      { id: "3", at: "2026-10-20T08:18:00.000Z", kind: "walk.resume", walkKey: "w" },
    ]);
    await s.apply({ id: "bille", name: "Herzii" }, [
      { id: "4", at: "2026-10-20T08:20:00.000Z", kind: "walk.join", walkKey: "w" },
      { id: "5", at: "2026-10-20T08:52:00.000Z", kind: "walk.stop", walkKey: "w" },
      { id: "6", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" },
      { id: "7", at: "2026-10-20T09:01:00.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: true, delta: 1 },
      { id: "7b", at: "2026-10-20T09:01:30.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: false, delta: 1 },
      ...[8, 9, 10].map((n) => ({ id: `${n}`, at: `2026-10-20T09:0${n - 6}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: kaese.id, delta: 1 as const })),
      { id: "11", at: "2026-10-20T09:12:00.000Z", kind: "training.stop", trainingKey: "t" },
    ]);
    const [training, walk] = (await diary().history({})).entries;
    expect(walk).toMatchObject({ type: "walk", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"], walkerIds: ["marcel", "bille"], exercises: [], treats: null, reps: [], treatCounts: [] });
    expect(training).toMatchObject({ type: "training", durationMin: 12, pauseMin: null, walkers: [], exercises: [{ name: "Sitz", ok: 1, fail: 1 }], treats: 3 });
    // in the shape editTraining takes, per dog and treat kind
    expect(training.reps).toEqual([{ exerciseId: sitz.id, dogId: 1, ok: 1, fail: 1 }]);
    expect(training.treatCounts).toEqual([{ treatKindId: kaese.id, count: 3 }]);
    const pee = await diary().log(HIRSCH, { type: "pee", at: "2026-10-20T10:00:00Z" });
    expect(pee).toMatchObject({ walkers: [], walkerIds: [], pauseMin: null, exercises: [], treats: null, reps: [], treatCounts: [] });
  });
});

describe("what happened during a walk", () => {
  test("a walk carries the pee, poop and the trainings' exercises that fell into its time; other entries carry none", async () => {
    clock = new Date("2026-10-20T12:00:00Z");
    const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"]]), now: () => clock });
    const sitz = await new Catalog(db()).addExercise("Sitz");
    await s.apply(HIRSCH, [
      { id: "1", at: "2026-10-20T08:00:00.000Z", kind: "walk.start", walkKey: "w" },
      { id: "2", at: "2026-10-20T08:05:00.000Z", kind: "log", type: "pee", dogId: 1 },
      { id: "3", at: "2026-10-20T08:06:00.000Z", kind: "log", type: "pee", dogId: 1 },
      { id: "4", at: "2026-10-20T08:07:00.000Z", kind: "log", type: "poop", dogId: 1 },
      { id: "5", at: "2026-10-20T08:10:00.000Z", kind: "training.start", trainingKey: "t", walkKey: "w" },
      { id: "6", at: "2026-10-20T08:11:00.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: true, delta: 1 },
      { id: "7", at: "2026-10-20T08:12:00.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: false, delta: 1 },
      { id: "8", at: "2026-10-20T08:15:00.000Z", kind: "training.stop", trainingKey: "t" },
      { id: "9", at: "2026-10-20T08:30:00.000Z", kind: "walk.stop", walkKey: "w" },
      { id: "10", at: "2026-10-20T09:00:00.000Z", kind: "log", type: "pee", dogId: 1 },
    ]);
    const { entries } = await diary().history({ type: "walk" });
    expect(entries[0].during).toEqual({ pees: 2, poops: 1, exercises: [{ name: "Sitz", ok: 1, fail: 1 }] });
    const pee = (await diary().history({ type: "pee" })).entries[0];
    expect(pee.during).toBeNull();
    expect((await diary().get(entries[0].id))?.during).toEqual(entries[0].during);
    expect(await diary().get(999)).toBeNull();
  });
});

describe("editing a walk's end", () => {
  const startWalk = async () => {
    clock = new Date("2026-10-20T12:00:00Z");
    const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"]]), now: () => clock });
    await s.apply(HIRSCH, [
      { id: "1", at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: "w" },
      { id: "2", at: "2026-10-20T09:30:00.000Z", kind: "walk.pause", walkKey: "w" },
      { id: "3", at: "2026-10-20T09:40:00.000Z", kind: "walk.resume", walkKey: "w" },
      { id: "4", at: "2026-10-20T09:50:00.000Z", kind: "walk.stop", walkKey: "w" },
    ]);
    return (await diary().history({})).entries[0];
  };

  test("the list counts only the pause inside the new end", async () => {
    const walk = await startWalk();
    expect(await diary().edit(walk.id, { at: walk.at, endedAt: "2026-10-20T09:35:00Z" })).toMatchObject({ durationMin: 35, pauseMin: 5 });
  });

  test("a finished walk that was started on the walk screen keeps an end", async () => {
    const walk = await startWalk();
    await expect(diary().edit(walk.id, { at: walk.at, endedAt: "" })).rejects.toThrow(new InputError("Eine beendete Runde braucht ein Ende."));
    const sheetWalk = await diary().log(HIRSCH, { type: "walk", at: "2026-10-20T07:00:00Z", endedAt: "2026-10-20T07:30:00Z" });
    expect(await diary().edit(sheetWalk.id, { at: sheetWalk.at, endedAt: "" })).toMatchObject({ endedAt: null }); // a moment, as in 0.1
  });
});

describe("walks that span days", () => {
  test("a walk across midnight shows in the Verlauf of both days", async () => {
    const d = diary();
    const walk = await d.log(HIRSCH, { type: "walk", at: "2026-10-19T21:30:00Z", endedAt: "2026-10-19T22:20:00Z" }); // 23:30–00:20
    await d.log(HIRSCH, { type: "pee", at: "2026-10-19T21:00:00Z" }); // 23:00 on the 19th
    expect((await d.history({ day: "2026-10-20" })).entries.map((e) => e.id)).toEqual([walk.id]);
    expect((await d.history({ day: "2026-10-19" })).entries.map((e) => e.id)).toContain(walk.id);
  });

  test("the week has a long walk that began days before Monday", async () => {
    clock = new Date("2026-10-22T12:00:00Z");
    await diary().log(HIRSCH, { type: "walk", at: "2026-10-17T18:00:00Z", endedAt: "2026-10-18T23:00:00Z" }); // Sat 20:00 – Mon 01:00
    const w = await diary().week("2026-10-19");
    expect(w.days[0].bars).toEqual([{ type: "walk", startMin: 0, endMin: 60 }]);
  });
});

test("food keeps its kind when edited", async () => {
  const e = await diary().log(HIRSCH, { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T09:00:00Z" });
  await expect(diary().edit(e.id, { at: e.at, amountG: 200, foodKind: "" })).rejects.toThrow(new InputError("Welche Futterart?"));
});

describe("entries and dogs", () => {
  const addDog = async (name: string) => (await db().insertInto("dog").values({ name, color: "#3a6fc0", created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow()).id;

  test("with one dog, pee needs no dog named; with two it does", async () => {
    expect(await diary().log(HIRSCH, { type: "pee", at: "2026-10-20T09:00:00Z" })).toMatchObject({ dogIds: [1] });
    const bruno = await addDog("Bruno");
    await expect(diary().log(HIRSCH, { type: "pee", at: "2026-10-20T09:05:00Z" })).rejects.toThrow(new InputError("Für welchen Hund?"));
    expect(await diary().log(HIRSCH, { type: "pee", dogIds: [bruno], at: "2026-10-20T09:05:00Z" })).toMatchObject({ dogIds: [bruno] });
    await expect(diary().log(HIRSCH, { type: "pee", dogIds: [1, bruno], at: "2026-10-20T09:06:00Z" })).rejects.toThrow(new InputError("Das geht nur für einen Hund."));
    expect(await diary().log(HIRSCH, { type: "food", foodKind: "dry", amountG: 80, at: "2026-10-20T09:07:00Z" })).toMatchObject({ dogIds: [1, bruno] });
    await expect(diary().log(HIRSCH, { type: "pee", dogIds: [999], at: "2026-10-20T09:08:00Z" })).rejects.toThrow(new InputError("Diesen Hund gibt es nicht."));
  });

  test("an old entry of an archived dog can still be edited with its dogs", async () => {
    const bruno = await addDog("Bruno");
    const walk = await diary().log(HIRSCH, { type: "walk", dogIds: [bruno], at: "2026-10-20T09:00:00Z" });
    await db().updateTable("dog").set({ archived: 1 }).where("id", "=", bruno).execute();
    expect(await diary().edit(walk.id, { at: walk.at, dogIds: [bruno], note: "der alte Weg" })).toMatchObject({ dogIds: [bruno], note: "der alte Weg" });
    await expect(diary().log(HIRSCH, { type: "walk", dogIds: [bruno], at: "2026-10-20T10:00:00Z" })).rejects.toThrow(new InputError("Diesen Hund gibt es nicht."));
  });

  test("entries list filters by dog", async () => {
    const bruno = await addDog("Bruno");
    await diary().log(HIRSCH, { type: "pee", dogIds: [1], at: "2026-10-20T09:00:00Z" });
    const his = await diary().log(HIRSCH, { type: "pee", dogIds: [bruno], at: "2026-10-20T09:01:00Z" });
    expect(diary().filter({ dog: String(bruno) })).toEqual({ dog: bruno });
    expect((await diary().history({ dog: bruno })).entries.map((e) => e.id)).toEqual([his.id]);
  });
});

describe("editing walkers and a training's repetitions afterwards", () => {
  const startedWalk = async () => {
    const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
    await s.apply(HIRSCH, [
      { id: "1", at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: "w" },
      { id: "2", at: "2026-10-20T09:50:00.000Z", kind: "walk.stop", walkKey: "w" },
    ]);
    return (await diary().history({})).entries[0];
  };

  test("a walk's walkers are replaced", async () => {
    const walk = await startedWalk();
    expect(walk.walkers).toEqual(["Hirsch"]);
    expect(await diary().edit(walk.id, { at: walk.at, endedAt: walk.endedAt, walkers: ["bille"] })).toMatchObject({ walkers: ["Herzii"] });
    expect(await diary().edit(walk.id, { at: walk.at, endedAt: walk.endedAt })).toMatchObject({ walkers: ["Herzii"] }); // left out: unchanged
  });

  test("walkers must be members, at least one, and only on walks", async () => {
    const walk = await startedWalk();
    const food = await diary().log(HIRSCH, { type: "food", foodKind: "wet", at: "2026-10-20T09:00:00Z", amountG: 200 });
    await expect(diary().edit(food.id, { at: food.at, foodKind: "wet", walkers: ["marcel"] })).rejects.toThrow(new InputError("Mitgeher gibt es nur bei Runden."));
    await expect(diary().edit(walk.id, { at: walk.at, endedAt: walk.endedAt, walkers: ["nobody"] })).rejects.toThrow(new InputError("Diese Person gibt es nicht."));
    await expect(diary().edit(walk.id, { at: walk.at, endedAt: walk.endedAt, walkers: [] })).rejects.toThrow(new InputError("Eine Runde braucht mindestens einen Mitgeher."));
    expect((await diary().history({})).entries.find((e) => e.id === walk.id)!.walkers).toEqual(["Hirsch"]);
  });

  describe("editTraining", () => {
    const training = async () => {
      const sitz = await new Catalog(db()).addExercise("Sitz");
      const platz = await new Catalog(db()).addExercise("Platz");
      const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
      const s = new Sessions({ db: db(), names: new Map([["marcel", "Hirsch"]]), now: () => clock });
      await s.apply(HIRSCH, [
        { id: "1", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" },
        { id: "2", at: "2026-10-20T09:01:00.000Z", kind: "training.rep", trainingKey: "t", exerciseId: sitz.id, dogId: 1, ok: true, delta: 1 },
        { id: "3", at: "2026-10-20T09:02:00.000Z", kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 },
      ]);
      const entry = (await diary().history({})).entries[0];
      return { entry, sitz, platz, kaese };
    };

    test("replaces both lists and shows the new exercises", async () => {
      const { entry, sitz, platz, kaese } = await training();
      expect(entry.exercises).toEqual([{ name: "Sitz", ok: 1, fail: 0 }]);
      const view = await diary().editTraining(entry.id, { reps: [{ exerciseId: platz.id, dogId: 1, ok: 3, fail: 1 }, { exerciseId: sitz.id, dogId: 1, ok: 0, fail: 0 }], treats: [{ treatKindId: kaese.id, count: 5 }] });
      expect(view).toMatchObject({ exercises: [{ name: "Platz", ok: 3, fail: 1 }], treats: 5 });
      expect(await diary().editTraining(entry.id, { reps: [], treats: [] })).toMatchObject({ exercises: [], treats: 0 });
    });

    test("treats already given keep their logged grams and dry flag; new kinds use the current ones", async () => {
      const { entry, kaese } = await training();
      await db().updateTable("treat_kind").set({ grams_per_piece: 9, from_dry: 1 }).where("id", "=", kaese.id).execute();
      const wurst = await new Catalog(db()).addTreatKind({ name: "Wurst", gramsPerPiece: 4, fromDry: true });
      await diary().editTraining(entry.id, { reps: [], treats: [{ treatKindId: kaese.id, count: 3 }, { treatKindId: wurst.id, count: 2 }] });
      const rows = await db().selectFrom("training_treat").select(["treat_kind_id", "count", "grams_per_piece", "from_dry"]).where("entry_id", "=", entry.id).orderBy("treat_kind_id").execute();
      expect(rows).toEqual([
        { treat_kind_id: kaese.id, count: 3, grams_per_piece: 1, from_dry: 0 },
        { treat_kind_id: wurst.id, count: 2, grams_per_piece: 4, from_dry: 1 },
      ]);
    });

    test("bumps the entry's change time and answers with the fresh entry", async () => {
      const { entry, platz } = await training();
      clock = new Date("2026-10-20T15:00:00Z");
      const view = await diary().editTraining(entry.id, { reps: [{ exerciseId: platz.id, dogId: 1, ok: 2, fail: 0 }], treats: [] });
      expect(view).toMatchObject({ updatedAt: "2026-10-20T15:00:00.000Z", reps: [{ exerciseId: platz.id, dogId: 1, ok: 2, fail: 0 }], treatCounts: [] });
      expect((await diary().history({})).entries[0].updatedAt).toBe("2026-10-20T15:00:00.000Z");
    });

    test("a dog taken out of the training takes its repetitions along", async () => {
      const bruno = (await db().insertInto("dog").values({ name: "Bruno", color: "#3a6fc0", created_at: "2026-01-01T00:00:00.000Z" }).returning("id").executeTakeFirstOrThrow()).id;
      const { entry, sitz } = await training();
      await diary().edit(entry.id, { at: entry.at, endedAt: entry.endedAt, dogIds: [1, bruno] });
      await diary().editTraining(entry.id, { reps: [{ exerciseId: sitz.id, dogId: 1, ok: 1, fail: 0 }, { exerciseId: sitz.id, dogId: bruno, ok: 2, fail: 1 }], treats: [] });
      const view = await diary().edit(entry.id, { at: entry.at, endedAt: entry.endedAt, dogIds: [1] });
      expect(view).toMatchObject({ dogIds: [1], reps: [{ exerciseId: sitz.id, dogId: 1, ok: 1, fail: 0 }], exercises: [{ name: "Sitz", ok: 1, fail: 0 }] });
    });

    test("refuses dogs outside the training, unknown ids, negative counts and other entries", async () => {
      const { entry, sitz, kaese } = await training();
      const food = await diary().log(HIRSCH, { type: "food", foodKind: "wet", at: "2026-10-20T09:00:00Z", amountG: 200 });
      const rep = { exerciseId: sitz.id, dogId: 1, ok: 1, fail: 0 };
      await expect(diary().editTraining(entry.id, { reps: [{ ...rep, dogId: 99 }], treats: [] })).rejects.toThrow(new InputError("Dieser Hund gehört nicht zum Training."));
      await expect(diary().editTraining(entry.id, { reps: [{ ...rep, exerciseId: 999 }], treats: [] })).rejects.toThrow(new InputError("Diese Übung gibt es nicht."));
      await expect(diary().editTraining(entry.id, { reps: [], treats: [{ treatKindId: 999, count: 1 }] })).rejects.toThrow(new InputError("Diese Leckerli-Art gibt es nicht."));
      await expect(diary().editTraining(entry.id, { reps: [{ ...rep, ok: -1 }], treats: [] })).rejects.toThrow(new InputError("Die Wiederholungen stimmen nicht."));
      await expect(diary().editTraining(food.id, { reps: [], treats: [{ treatKindId: kaese.id, count: 1 }] })).rejects.toThrow(new InputError("Das ist kein Training."));
      expect(await diary().editTraining(999, { reps: [], treats: [] })).toBeNull();
      expect((await diary().history({})).entries.find((e) => e.id === entry.id)).toMatchObject({ exercises: [{ name: "Sitz", ok: 1, fail: 0 }], treats: 1 });
    });
  });
});
