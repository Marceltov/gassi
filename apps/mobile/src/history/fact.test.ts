import { expect, test } from "vitest";
import { factOf } from "./fact";
import type { Entry, Form } from "./form";

const TZ = "Europe/Berlin";
const names = { dogName: (id: number) => (id === 1 ? "Bruno" : "Toffee"), exerciseName: (id: number) => (id === 7 ? "Sitz" : "Platz"), timeZone: TZ };
const entry = (more: Partial<Entry>): Entry => ({ type: "note", at: "2026-10-22T05:19:00.000Z", endedAt: null, amountG: null, unitG: null, foodKind: null, dogIds: [], count: null, ...more }) as Entry;
const form = (more: Partial<Form> = {}): Form => ({ at: "2026-10-22T05:19:00.000Z", endedAt: null, dogIds: [1], walkerIds: [], amountG: null, foodKind: null, note: "", reps: [], treats: [], ...more }) as Form;

test("an opened can: its size large, one can of wet food", () => {
  expect(factOf(entry({ type: "opened", unitG: 400, amountG: 400, foodKind: "wet" }), form(), names)).toEqual({ big: "400 g", sub: "eine Dose Nassfutter" });
});

test("a wet count: one row per size with its closed cans, and what they come to", () => {
  const count = entry({ type: "stockcheck", foodKind: "wet", count: [{ unitG: 400, amountG: 4800 }, { unitG: 800, amountG: 1600 }] });
  expect(factOf(count, form(), names)).toEqual({ rows: [{ label: "Dosen à 400 g", value: "12" }, { label: "Dosen à 800 g", value: "2" }], sum: "zusammen 6,4 kg" });
});

test("a dry count and a dry purchase: the kg large", () => {
  expect(factOf(entry({ type: "stockcheck", foodKind: "dry", amountG: 3500 }), form(), names)).toEqual({ big: "3,5 kg", sub: "Trockenfutter gezählt" });
  expect(factOf(entry({ type: "restock", foodKind: "dry", amountG: 10_000 }), form(), names)).toEqual({ big: "10 kg", sub: "Trockenfutter gekauft" });
});

test("a wet purchase: the cans large, their size and weight under them", () => {
  expect(factOf(entry({ type: "restock", foodKind: "wet", unitG: 400, amountG: 4800 }), form(), names)).toEqual({ big: "12 Dosen", sub: "à 400 g · 4,8 kg" });
});

test("pee and poop: the time large, the dog and the day under it, as edited", () => {
  expect(factOf(entry({ type: "pee" }), form({ at: "2026-10-22T05:19:00.000Z", dogIds: [1] }), names)).toEqual({ big: "07:19", sub: "Bruno · Do., 22.10." });
  expect(factOf(entry({ type: "poop" }), form({ at: "2026-10-22T06:00:00.000Z", dogIds: [2] }), names)).toEqual({ big: "08:00", sub: "Toffee · Do., 22.10." });
});

test("a training: its minutes large and what was trained under them; one still running says so", () => {
  const reps = [{ exerciseId: 7, dogId: 1, ok: 4, fail: 1 }];
  expect(factOf(entry({ type: "training" }), form({ endedAt: "2026-10-22T05:31:00.000Z", reps, treats: [{ treatKindId: 1, count: 3 }] }), names)).toEqual({ big: "12 Min.", sub: "Sitz 4/5 · 3 Leckerli" });
  expect(factOf(entry({ type: "training" }), form({ reps }), names)).toEqual({ big: "läuft", sub: "Sitz 4/5" });
});

test("food, weight, a walk and a note have their own: no fact on top", () => {
  for (const type of ["food", "weight", "walk", "note"] as const) expect(factOf(entry({ type }), form(), names)).toBeNull();
});
