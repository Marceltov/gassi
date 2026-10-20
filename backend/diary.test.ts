import { describe, expect, test } from "vitest";
import { freshDatabase } from "./db/testing";
import { Diary, HISTORY_PAGE, InputError } from "./diary";
import { Catalog } from "./catalog";
import { Sessions } from "./sessions";

const { db } = freshDatabase();
const HIRSCH = { username: "marcel", name: "Hirsch" };
let clock = new Date("2026-10-20T10:00:00Z");
const diary = () => new Diary({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), timeZone: "Europe/Berlin", now: () => clock });

describe("log", () => {
  test("logs for the signed-in user and shows their display name", async () => {
    const e = await diary().log(HIRSCH, { type: "food", at: "2026-10-20T09:00:00Z", amountG: "200", note: "  " });
    expect(e).toMatchObject({ type: "food", at: "2026-10-20T09:00:00.000Z", amountG: 200, note: null, loggedBy: "marcel", byName: "Hirsch" });
  });

  test.each([
    [{ type: "walk", at: "gestern" }, "Die Zeit fehlt oder stimmt nicht."],
    [{ type: "walk", at: "2026-10-20T09:00:00Z", endedAt: "2026-10-20T08:00:00Z" }, /Ende/],
    [{ type: "food", at: "2026-10-20T09:00:00Z", foodKind: "canned" }, /Futterart/],
    [{ type: "food", at: "2026-10-20T09:00:00Z", amountG: -1 }, /Menge/],
    [{ type: "bark", at: "2026-10-20T09:00:00Z" }, /Art/],
  ])("rejects %j", async (input, message) => {
    await expect(diary().log(HIRSCH, input)).rejects.toBeInstanceOf(InputError);
    await expect(diary().log(HIRSCH, input)).rejects.toThrow(message);
  });

  test("logAs takes only people who have signed in", async () => {
    expect(await diary().logAs("bille", { type: "pee", at: "2026-10-20T09:00:00Z" })).toMatchObject({ byName: "Herzii" });
    await expect(diary().logAs("mallory", { type: "pee", at: "2026-10-20T09:00:00Z" })).rejects.toThrow(InputError);
  });
});

describe("today", () => {
  test("has today's entries in Berlin and the latest of each tile type", async () => {
    clock = new Date("2026-10-20T22:30:00Z"); // 00:30 on the 21st in Berlin
    const d = diary();
    await d.log(HIRSCH, { type: "walk", at: "2026-10-20T21:30:00Z" }); // 23:30 on the 20th
    const pee1 = await d.log(HIRSCH, { type: "pee", at: "2026-10-20T22:05:00Z" });
    const pee2 = await d.logAs("bille", { type: "pee", at: "2026-10-20T22:20:00Z" });
    const today = await d.today();
    expect(today.entries.map((e) => e.id)).toEqual([pee2.id, pee1.id]);
    expect(today.tiles).toEqual({ walk: null, food: null, pee: pee2, poop: null });
    expect(today).toMatchObject({ dogName: "Toffee", timeZone: "Europe/Berlin", now: clock.toISOString() });
  });

  test("shows the walk that runs now", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    await new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"]]), now: () => clock }).apply(HIRSCH, [{ id: "c1", at: "2026-10-20T09:40:00.000Z", kind: "walk.start", walkKey: "w" }]);
    const today = await diary().today();
    expect(today.sessions).toEqual({ walk: { key: "w", startedAt: "2026-10-20T09:40:00.000Z", walkers: [HIRSCH], pauses: [], paused: false }, training: null });
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
  await d.logAs("bille", { type: "food", at: "2026-10-02T00:00:00Z" });
  const first = await d.history({});
  expect(first.entries).toHaveLength(HISTORY_PAGE);
  expect(first.more).toBe(true);
  const second = await d.history({}, HISTORY_PAGE);
  expect(second.entries).toHaveLength(2);
  expect(second.more).toBe(false);
  expect((await d.history({ by: "bille" })).entries).toHaveLength(1);
  expect((await d.history({ type: "food" })).entries[0].byName).toBe("Herzii");
});

test("filter keeps only known types and people", () => {
  const d = diary();
  expect(d.filter({ type: "walk", by: "marcel" })).toEqual({ type: "walk", by: "marcel" });
  expect(d.filter({ type: "bark", by: "mallory" })).toEqual({});
  expect(d.filter({ type: ["walk"], by: 1 })).toEqual({});
});

test("an entry by someone without a remembered name shows their username", async () => {
  const d = diary();
  await d.log({ username: "gast", name: "Gast" }, { type: "pee", at: "2026-10-20T09:00:00Z" });
  expect((await d.all())[0].byName).toBe("gast");
});

describe("food and stock", () => {
  test("suggests the last amount per food kind", async () => {
    const d = diary();
    expect(await d.lastFoodAmounts()).toEqual({ wet: null, dry: null });
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T07:00:00Z" });
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 180, at: "2026-10-20T08:00:00Z" });
    await d.log(HIRSCH, { type: "food", foodKind: "dry", amountG: 80, at: "2026-10-20T08:30:00Z" });
    await d.log(HIRSCH, { type: "food", amountG: 999, at: "2026-10-20T09:00:00Z" });
    expect(await d.lastFoodAmounts()).toEqual({ wet: 180, dry: 80 });
    expect((await d.today()).lastFood).toEqual({ wet: 180, dry: 80 });
  });

  test("restocks: cans × grams per can for wet food, grams for dry food", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    expect(await d.restock(HIRSCH, { foodKind: "wet", cans: 12, unitG: 400 })).toMatchObject({ type: "restock", foodKind: "wet", amountG: 4800, unitG: 400, at: clock.toISOString() });
    expect(await d.restock(HIRSCH, { foodKind: "dry", grams: 10_000 })).toMatchObject({ type: "restock", foodKind: "dry", amountG: 10_000, unitG: null });
    await d.log(HIRSCH, { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T10:30:00Z" });
    clock = new Date("2026-10-20T11:00:00Z");
    expect((await d.stock()).wet).toMatchObject({ grams: 4600, cans: 11.5 });
  });

  test("a restock needs cans and can size, or grams", async () => {
    await expect(diary().restock(HIRSCH, { foodKind: "wet", cans: 12 })).rejects.toThrow(new InputError("Wie viele Dosen, und wie viel Gramm hat eine Dose?"));
    await expect(diary().restock(HIRSCH, { foodKind: "dry", grams: 0 })).rejects.toThrow(new InputError("Wie viel Gramm hast du gekauft?"));
    await expect(diary().restock(HIRSCH, { foodKind: "canned", grams: 10 })).rejects.toThrow(InputError);
  });

  test("correcting the stock: wet in cans of the last can size, dry in grams", async () => {
    clock = new Date("2026-10-20T10:00:00Z");
    const d = diary();
    await expect(d.correctStock(HIRSCH, { foodKind: "wet", cans: 5 })).rejects.toThrow(new InputError("Trag erst einen Einkauf mit Dosengröße ein."));
    await d.restock(HIRSCH, { foodKind: "wet", cans: 12, unitG: 400 });
    clock = new Date("2026-10-20T10:05:00Z");
    expect(await d.correctStock(HIRSCH, { foodKind: "wet", cans: 5 })).toMatchObject({ type: "stockcheck", foodKind: "wet", amountG: 2000 });
    expect(await d.correctStock(HIRSCH, { foodKind: "dry", grams: 0 })).toMatchObject({ type: "stockcheck", foodKind: "dry", amountG: 0 });
    clock = new Date("2026-10-20T10:10:00Z");
    expect(await d.stock()).toMatchObject({ wet: { grams: 2000, cans: 5 }, dry: { grams: 0 } });
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
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    await s.apply(HIRSCH, [{ id: "1", at: "2026-10-21T08:00:00.000Z", kind: "walk.start", walkKey: "w" }]);
    await s.apply({ username: "bille", name: "Herzii" }, [
      { id: "2", at: "2026-10-21T08:01:00.000Z", kind: "walk.join", walkKey: "w" },
      { id: "3", at: "2026-10-21T08:10:00.000Z", kind: "training.start", trainingKey: "t", walkKey: "w" },
      { id: "4", at: "2026-10-21T08:11:00.000Z", kind: "training.exercise", trainingKey: "t", exerciseId: sitz.id, on: true },
      { id: "5", at: "2026-10-21T08:12:00.000Z", kind: "training.treat", trainingKey: "t", treatKindId: kaese.id, delta: 1 },
      { id: "6", at: "2026-10-21T08:40:00.000Z", kind: "walk.stop", walkKey: "w" },
    ]);
    const w = await diary().week("2026-10-19");
    expect(w.monday).toBe("2026-10-19");
    expect(w.walkMinByPerson).toEqual([
      { username: "bille", name: "Herzii", min: 40 },
      { username: "marcel", name: "Hirsch", min: 40 },
    ]);
    expect(w.exerciseCounts).toEqual([{ name: "Sitz", count: 1 }]);
    expect(w.treats).toBe(1);
    expect((await diary().week("bogus")).monday).toBe("2026-10-19"); // this week
    expect((await diary().week("2026-10-21")).monday).toBe("2026-10-19"); // any day → its Monday
  });
});

describe("entries carry their walk and training details", () => {
  test("walkers and pause of a walk, exercises and treats of a training", async () => {
    clock = new Date("2026-10-20T12:00:00Z");
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"], ["bille", "Herzii"]]), now: () => clock });
    const sitz = await new Catalog(db()).addExercise("Sitz");
    const kaese = await new Catalog(db()).addTreatKind({ name: "Käse", gramsPerPiece: 1, fromDry: false });
    await s.apply(HIRSCH, [
      { id: "1", at: "2026-10-20T08:00:00.000Z", kind: "walk.start", walkKey: "w" },
      { id: "2", at: "2026-10-20T08:10:00.000Z", kind: "walk.pause", walkKey: "w" },
      { id: "3", at: "2026-10-20T08:18:00.000Z", kind: "walk.resume", walkKey: "w" },
    ]);
    await s.apply({ username: "bille", name: "Herzii" }, [
      { id: "4", at: "2026-10-20T08:20:00.000Z", kind: "walk.join", walkKey: "w" },
      { id: "5", at: "2026-10-20T08:52:00.000Z", kind: "walk.stop", walkKey: "w" },
      { id: "6", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" },
      { id: "7", at: "2026-10-20T09:01:00.000Z", kind: "training.exercise", trainingKey: "t", exerciseId: sitz.id, on: true },
      ...[8, 9, 10].map((n) => ({ id: `${n}`, at: `2026-10-20T09:0${n - 6}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: kaese.id, delta: 1 as const })),
      { id: "11", at: "2026-10-20T09:12:00.000Z", kind: "training.stop", trainingKey: "t" },
    ]);
    const [training, walk] = (await diary().history({})).entries;
    expect(walk).toMatchObject({ type: "walk", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"], exercises: [], treats: null });
    expect(training).toMatchObject({ type: "training", durationMin: 12, pauseMin: null, walkers: [], exercises: ["Sitz"], treats: 3 });
    const pee = await diary().log(HIRSCH, { type: "pee", at: "2026-10-20T10:00:00Z" });
    expect(pee).toMatchObject({ walkers: [], pauseMin: null, exercises: [], treats: null });
  });
});
