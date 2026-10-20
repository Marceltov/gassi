import { expect, test } from "vitest";
import { type DescribableEntry, describeEntry } from "./describe";

const entry = (more: Partial<DescribableEntry>): DescribableEntry => ({
  type: "walk",
  endedAt: null,
  durationMin: null,
  amountG: null,
  foodKind: null,
  unitG: null,
  clientKey: null,
  walkers: [],
  pauseMin: null,
  exercises: [],
  treats: null,
  byName: "Hirsch",
  ...more,
});
const text = (e: DescribableEntry) => {
  const d = describeEntry(e);
  return `${d.title}${d.extra ? `, ${d.extra}` : ""} ${d.by}`;
};

test("a walk: duration with pause and who walked", () => {
  expect(text(entry({ endedAt: "x", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"] }))).toBe("Gassi, 52 Min. (8 Pause) Hirsch + Herzii");
  expect(text(entry({ endedAt: "x", durationMin: 30, pauseMin: 0, walkers: ["Hirsch"] }))).toBe("Gassi, 30 Min. Hirsch");
  expect(text(entry({ durationMin: 30 }))).toBe("Gassi, 30 Min. von Hirsch");
  expect(text(entry({ clientKey: "k", walkers: ["Hirsch"] }))).toBe("Gassi, läuft Hirsch");
});

test("a training: duration, exercises and treats", () => {
  expect(text(entry({ type: "training", endedAt: "x", durationMin: 12, exercises: ["Rückruf", "Sitz"], treats: 6, byName: "Herzii" }))).toBe("Training, 12 Min.: Rückruf, Sitz, 6 Leckerlis von Herzii");
  expect(text(entry({ type: "training", endedAt: "x", durationMin: 5, treats: 1 }))).toBe("Training, 5 Min., 1 Leckerli von Hirsch");
});

test("food, weight, restock and stock", () => {
  expect(text(entry({ type: "food", foodKind: "wet", amountG: 200 }))).toBe("Futter, Nassfutter, 200 g von Hirsch");
  expect(text(entry({ type: "food", amountG: 200 }))).toBe("Futter, 200 g von Hirsch");
  expect(text(entry({ type: "weight", amountG: 12_400 }))).toBe("Gewicht, 12,4 kg von Hirsch");
  expect(text(entry({ type: "restock", foodKind: "wet", amountG: 4800, unitG: 400 }))).toBe("Einkauf Nassfutter, 12 × 400 g von Hirsch");
  expect(text(entry({ type: "restock", foodKind: "dry", amountG: 10_000 }))).toBe("Einkauf Trockenfutter, 10 kg von Hirsch");
  expect(text(entry({ type: "stockcheck", foodKind: "dry", amountG: 3500 }))).toBe("Bestand Trockenfutter, 3,5 kg von Hirsch");
});
