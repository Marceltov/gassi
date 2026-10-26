import { expect, test } from "vitest";
import { type DescribableEntry, describeEntry, formatDistance, formatSpeed } from "./describe";

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

test("a walk: duration with pause, distance and who walked", () => {
  expect(text(entry({ endedAt: "x", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"] }))).toBe("Gassi, 52 Min. (8 Pause) Hirsch + Herzii");
  expect(text(entry({ endedAt: "x", durationMin: 95, pauseMin: 0, distanceM: 3149, walkers: ["Hirsch"] }))).toBe("Gassi, 1 Std. 35 Min. · 3,1 km Hirsch");
  expect(text(entry({ endedAt: "x", durationMin: 30, pauseMin: 0, walkers: ["Hirsch"] }))).toBe("Gassi, 30 Min. Hirsch");
  expect(text(entry({ durationMin: 30 }))).toBe("Gassi, 30 Min. von Hirsch");
  expect(text(entry({ clientKey: "k", walkers: ["Hirsch"] }))).toBe("Gassi, läuft Hirsch");
});

test("what happened during a walk: pee, markings, poop and the exercises with their success", () => {
  const during = (d: DescribableEntry["during"]) => describeEntry(entry({ endedAt: "x", durationMin: 40, during: d })).during;
  expect(during({ pees: 2, marks: 5, poops: 1, exercises: [{ name: "Sitz", ok: 4, fail: 1 }] })).toBe("2× Pipi · 5× markiert · 1× Poopoo · Sitz 4/5");
  expect(during({ pees: 0, marks: 0, poops: 1, exercises: [] })).toBe("1× Poopoo");
  expect(during({ pees: 0, marks: 0, poops: 0, exercises: [] })).toBe("");
  expect(during(null)).toBe("");
});

test("a poop says its consistency when it has one; a marking is its own kind", () => {
  expect(text(entry({ type: "poop", details: { consistency: "mushy" } }))).toBe("Poopoo, breiig von Hirsch");
  expect(text(entry({ type: "poop" }))).toBe("Poopoo von Hirsch");
  expect(text(entry({ type: "mark" }))).toBe("Markiert von Hirsch");
});

test("a training: duration, exercises with successes / repetitions, and treats", () => {
  expect(text(entry({ type: "training", endedAt: "x", durationMin: 12, exercises: [{ name: "Rückruf", ok: 1, fail: 0 }, { name: "Sitz", ok: 2, fail: 1 }], treats: 6, byName: "Herzii" }))).toBe("Training, 12 Min. · Rückruf 1/1 · Sitz 2/3 · 6 Leckerli von Herzii");
  expect(text(entry({ type: "training", endedAt: "x", durationMin: 5, treats: 1 }))).toBe("Training, 5 Min. · 1 Leckerli von Hirsch");
  expect(text(entry({ type: "training", clientKey: "k", exercises: [{ name: "Sitz", ok: 1, fail: 0 }], treats: 0 }))).toBe("Training, läuft · Sitz 1/1 von Hirsch");
});

test("food, weight, restock and stock", () => {
  expect(text(entry({ type: "food", foodKind: "wet", amountG: 200 }))).toBe("Futter, Nassfutter, 200 g von Hirsch");
  expect(text(entry({ type: "food", amountG: 200 }))).toBe("Futter, 200 g von Hirsch");
  expect(text(entry({ type: "weight", amountG: 12_400 }))).toBe("Gewicht, 12,4 kg von Hirsch");
  expect(text(entry({ type: "restock", foodKind: "wet", amountG: 4800, unitG: 400 }))).toBe("Einkauf Nassfutter, 12 × 400 g von Hirsch");
  expect(text(entry({ type: "restock", foodKind: "dry", amountG: 10_000 }))).toBe("Einkauf Trockenfutter, 10 kg von Hirsch");
  expect(text(entry({ type: "stockcheck", foodKind: "dry", amountG: 3500 }))).toBe("Bestand Trockenfutter, 3,5 kg von Hirsch");
  expect(text(entry({ type: "stockcheck", foodKind: "wet", amountG: 1000, unitG: 400 }))).toBe("Bestand Nassfutter, 2 × 400 g von Hirsch"); // closed cans
  expect(text(entry({ type: "opened", foodKind: "wet", amountG: 400, unitG: 400 }))).toBe("Dose aufgemacht, 400-g-Dose von Hirsch");
  // a wet count's row names all its sizes
  expect(text(entry({ type: "stockcheck", foodKind: "wet", amountG: 4800, unitG: 400, count: [{ unitG: 400, amountG: 4800 }, { unitG: 800, amountG: 1600 }] }))).toBe("Bestand Nassfutter, 12 × 400 g, 2 × 800 g von Hirsch");
});

test("a distance reads in metres under a kilometre, else in km with one decimal", () => {
  expect([formatDistance(0), formatDistance(849.6), formatDistance(1000), formatDistance(3149)]).toEqual(["0 m", "850 m", "1,0 km", "3,1 km"]);
});

test("an encounter reads in short", () => {
  expect(text(entry({ type: "dogEncounter", details: { reaction: 2, handling: "wideBerth", distance: "near" } }))).toBe("Hundebegegnung, 2 fiept · großer Bogen · nah von Hirsch");
  expect(text(entry({ type: "dogEncounter", details: { reaction: 1, handling: "lifted" } }))).toBe("Hundebegegnung, 1 schaut · hochgehoben von Hirsch");
  expect(text(entry({ type: "personEncounter", details: { who: "Oma Inge", rating: 7, place: "home", sounds: ["growls", "whines"] } }))).toBe("Menschenbegegnung, Oma Inge · bei uns · 7/10 · knurrt · fiept von Hirsch");
});

test("both encounters can say what he said; a poop its consistency", () => {
  expect(text(entry({ type: "dogEncounter", details: { reaction: 3, sounds: ["screeches"], attention: "none" } }))).toBe("Hundebegegnung, 3 bellt · kreischt · ansprechbar: nicht von Hirsch");
  expect(text(entry({ type: "personEncounter", details: { who: "Paketbote", rating: 2, insecurity: 8, moods: ["afraid"] } }))).toBe("Menschenbegegnung, Paketbote · 2/10 · ängstlich · unsicher 8/10 von Hirsch");
});

test("a walk's speed reads in km/h with one decimal (#104)", () => {
  expect(formatSpeed(1.03)).toBe("3,7 km/h");
  expect(formatSpeed(0)).toBe("0,0 km/h");
});
