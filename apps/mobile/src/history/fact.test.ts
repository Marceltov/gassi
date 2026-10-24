import { expect, test } from "vitest";
import { factOf } from "./fact";
import { type Entry, type Form, formOf } from "./form";

const TZ = "Europe/Berlin";
const names = { dogName: (id: number) => (id === 1 ? "Bruno" : "Toffee"), exerciseName: (id: number) => (id === 7 ? "Sitz" : "Platz"), timeZone: TZ };
const entry = (more: Partial<Entry>): Entry => ({ id: 1, type: "note", at: "2026-10-22T05:19:00.000Z", endedAt: null, amountG: null, unitG: null, foodKind: null, dogIds: [1], walkerIds: [], note: null, reps: [], treatCounts: [], count: null, ...more }) as Entry;
/** The entry as its detail starts, changed by `more`. */
const fact = (e: Entry, more: Partial<Form> = {}) => factOf(e, { ...formOf(e), ...more }, names);

test("an opened can: its size large, one can of wet food", () => {
  expect(fact(entry({ type: "opened", unitG: 400, amountG: 400, foodKind: "wet" }))).toEqual({ big: "400 g", sub: "eine Dose Nassfutter" });
});

test("a wet count: one row per size with its closed cans, and what they come to", () => {
  const count = entry({ type: "stockcheck", foodKind: "wet", count: [{ id: 1, unitG: 400, amountG: 4800 }, { id: 2, unitG: 800, amountG: 1600 }] });
  expect(fact(count)).toEqual({ rows: [{ label: "Dosen à 400 g", value: "12" }, { label: "Dosen à 800 g", value: "2" }], sum: "zusammen 6,4 kg" });
});

test("a dry count and a dry purchase: the kg large", () => {
  expect(fact(entry({ type: "stockcheck", foodKind: "dry", amountG: 3500 }))).toEqual({ big: "3,5 kg", sub: "Trockenfutter gezählt" });
  expect(fact(entry({ type: "restock", foodKind: "dry", amountG: 10_000 }))).toEqual({ big: "10 kg", sub: "Trockenfutter gekauft" });
});

test("a wet purchase: the cans large, their size and weight under them", () => {
  expect(fact(entry({ type: "restock", foodKind: "wet", unitG: 400, amountG: 4800 }))).toEqual({ big: "12 Dosen", sub: "à 400 g · 4,8 kg" });
  expect(fact(entry({ type: "restock", foodKind: "wet", unitG: 900, amountG: 900 }))).toMatchObject({ big: "1 Dose" });
});

test("pee and poop: the time large, the dog and the day under it, as edited", () => {
  expect(fact(entry({ type: "pee" }), { at: "2026-10-22T05:19:00.000Z", dogIds: [1] })).toEqual({ big: "07:19", sub: "Bruno · Do., 22.10." });
  expect(fact(entry({ type: "poop" }), { at: "2026-10-22T06:00:00.000Z", dogIds: [2] })).toEqual({ big: "08:00", sub: "Toffee · Do., 22.10." });
});

test("a training: its minutes large and what was trained under them; one still running says so", () => {
  const reps = [{ exerciseId: 7, dogId: 1, ok: 4, meh: 0, fail: 1 }];
  expect(fact(entry({ type: "training" }), { endedAt: "2026-10-22T05:31:00.000Z", reps, treats: [{ treatKindId: 1, count: 3 }] })).toEqual({ big: "12 Min.", sub: "Sitz ✓4 ~0 ✗1 · 3 Leckerli" });
  expect(fact(entry({ type: "training" }), { reps })).toEqual({ big: "läuft", sub: "Sitz ✓4 ~0 ✗1" });
});

test("food, weight, a walk and a note have their own: no fact on top", () => {
  for (const type of ["food", "weight", "walk", "note"] as const) expect(fact(entry({ type }))).toBeNull();
});

test("the large value follows what is being changed: an opened can's size, a purchase's cans, a count's rows", () => {
  expect(fact(entry({ type: "opened", unitG: 400, amountG: 400, foodKind: "wet" }), { unitG: 800 })).toMatchObject({ big: "800 g" });
  expect(fact(entry({ type: "restock", foodKind: "wet", unitG: 400, amountG: 4800 }), { amountG: 5200 })).toMatchObject({ big: "13 Dosen", sub: "à 400 g · 5,2 kg" });
  const count = entry({ type: "stockcheck", foodKind: "wet", count: [{ id: 1, unitG: 400, amountG: 4800 }] });
  expect(fact(count, { count: [{ id: 1, unitG: 400, cans: 10 }] })).toEqual({ rows: [{ label: "Dosen à 400 g", value: "10" }], sum: "zusammen 4 kg" });
});
