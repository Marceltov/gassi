import { expect, test } from "vitest";
import { canChoices, clampPortion, countLine, countTitle, formatCanCount, portionFor, prefillFood, quickPortions, stockLine, stockParts, stockSummary } from "./food";
import type { CanStock, Stock, WetStock } from "./stock";

const can = (unitG: number, cans: number): CanStock => ({ unitG, grams: cans * unitG, cans, belowZero: false });
const wetStock = (sizes: CanStock[], more: Partial<WetStock> = {}): WetStock => ({ grams: sizes.reduce((s, c) => s + c.grams, 0), daysLeft: null, belowZero: false, sizes, newestUnitG: sizes.at(-1)?.unitG ?? null, ...more });
const UNKNOWN_WET: WetStock = { grams: null, daysLeft: null, belowZero: false, sizes: [], newestUnitG: null };

const wet = (amountG: number) => ({ foodKind: "wet" as const, amountG });
const dry = (amountG: number) => ({ foodKind: "dry" as const, amountG });

test("the newest feeding decides the kind, the last portion of that kind the grams", () => {
  expect(prefillFood([dry(50), wet(80)], { wet: 80, dry: 55 })).toEqual({ foodKind: "dry", amountG: 55 });
  expect(prefillFood([wet(80), dry(50)], { wet: 85, dry: 50 })).toEqual({ foodKind: "wet", amountG: 85 });
});

test("with less to go on: the recent portion of the kind, the kind that has a last portion, then defaults", () => {
  expect(portionFor("dry", [wet(80), dry(45)], null)).toBe(45);
  expect(prefillFood([], { wet: null, dry: 60 })).toEqual({ foodKind: "dry", amountG: 60 });
  expect(prefillFood([], null)).toEqual({ foodKind: "wet", amountG: 100 });
});

test("quick amounts: recent portions of the kind without repeats, and half and whole can for wet food", () => {
  const recent = [wet(80), dry(50), wet(80), wet(40), wet(95)];
  expect(quickPortions(recent, "wet", 400)).toEqual([{ label: "80 g", amountG: 80 }, { label: "40 g", amountG: 40 }, { label: "½ Dose", amountG: 200 }, { label: "1 Dose", amountG: 400 }]);
  expect(quickPortions(recent, "wet", null).map((q) => q.amountG)).toEqual([80, 40, 95]);
  expect(quickPortions(recent, "dry", 400)).toEqual([{ label: "50 g", amountG: 50 }]);
  expect(quickPortions([wet(200)], "wet", 400).map((q) => q.label)).toEqual(["½ Dose", "1 Dose"]); // the same amount only once
});

test("a can size's count: whole and half cans × grams", () => {
  expect(formatCanCount(can(400, 3))).toBe("3 × 400 g");
  expect(formatCanCount(can(800, 2.5))).toBe("2½ × 800 g");
  expect(formatCanCount(can(400, 0.5))).toBe("½ × 400 g");
});

test("the stock line says what is left per can size and for how long", () => {
  const stock: Stock = { wet: wetStock([can(400, 3), can(800, 2)], { daysLeft: 9.2 }), dry: { grams: 1200, daysLeft: 1, belowZero: false } };
  expect(stockLine(stock, "wet")).toBe("Vorrat: noch 3 × 400 g · 2 × 800 g · reicht etwa 9 Tage");
  expect(stockLine(stock, "dry")).toBe("Vorrat: noch 1,2 kg · reicht etwa 1 Tag");
  expect(stockLine({ ...stock, dry: { grams: null, daysLeft: null, belowZero: false } }, "dry")).toBeNull();
  expect(stockLine({ ...stock, dry: { grams: 0, daysLeft: 0, belowZero: true } }, "dry")).toBe("Vorrat aufgebraucht");
  expect(stockLine({ ...stock, dry: { grams: 300, daysLeft: 0.4, belowZero: false } }, "dry")).toBe("Vorrat: noch 300 g · reicht weniger als einen Tag");
  expect(stockLine({ ...stock, dry: { grams: 0, daysLeft: 0, belowZero: false } }, "dry")).toBe("Vorrat aufgebraucht");
  expect(stockLine({ ...stock, wet: wetStock([can(400, 0), can(800, 0)]) }, "wet")).toBe("Vorrat aufgebraucht");
});

test("the stock in parts, for the stock screen: per can size, the total, for how long, and whether it ran out", () => {
  const stock: Stock = { wet: wetStock([can(400, 3), can(800, 2)], { daysLeft: 9.2 }), dry: { grams: 300, daysLeft: 0.4, belowZero: false } };
  expect(stockParts(stock, "wet")).toEqual({ left: "3 × 400 g · 2 × 800 g", sizes: ["3 × 400 g", "2 × 800 g"], total: "zusammen 2,8 kg", lasts: "reicht etwa 9 Tage", empty: false });
  expect(stockParts({ ...stock, wet: wetStock([can(400, 0), can(800, 2.5)]) }, "wet")).toMatchObject({ sizes: ["2½ × 800 g"], total: "zusammen 2 kg" });
  expect(stockParts(stock, "dry")).toEqual({ left: "300 g", sizes: [], total: null, lasts: "reicht weniger als einen Tag", empty: false });
  expect(stockParts({ ...stock, dry: { grams: null, daysLeft: null, belowZero: false } }, "dry")).toEqual({ left: null, sizes: [], total: null, lasts: null, empty: false });
  expect(stockParts({ ...stock, dry: { grams: 0, daysLeft: 0, belowZero: true } }, "dry")).toMatchObject({ left: "0 g", lasts: null, empty: true });
  expect(stockParts({ ...stock, wet: UNKNOWN_WET }, "wet")).toEqual({ left: null, sizes: [], total: null, lasts: null, empty: false });
  // one size below zero doesn't make the other run out
  expect(stockParts({ ...stock, wet: wetStock([{ ...can(400, 0), belowZero: true }, can(800, 1)], { belowZero: true }) }, "wet")).toMatchObject({ sizes: ["1 × 800 g"], empty: false });
  expect(stockParts({ ...stock, wet: wetStock([can(400, 0)]) }, "wet")).toMatchObject({ left: "0 Dosen", empty: true, total: null });
});

test("the can sizes to feed from: the known ones, pre-set to the last used one, else the one bought last", () => {
  const stock: Stock = { wet: wetStock([can(400, 3), can(800, 2)], { newestUnitG: 400 }), dry: { grams: null, daysLeft: null, belowZero: false } };
  expect(canChoices(stock, { wet: 100, dry: null, wetUnitG: 800 })).toEqual({ sizes: [400, 800], preset: 800 });
  expect(canChoices(stock, { wet: 100, dry: null, wetUnitG: null })).toEqual({ sizes: [400, 800], preset: 400 });
  expect(canChoices(stock, { wet: 100, dry: null, wetUnitG: 200 })).toEqual({ sizes: [400, 800], preset: 400 }); // a size no longer known
  expect(canChoices({ ...stock, wet: wetStock([can(400, 1)], { newestUnitG: null }) }, null)).toEqual({ sizes: [400], preset: 400 });
  expect(canChoices(null, { wet: 100, dry: null, wetUnitG: 800 })).toEqual({ sizes: [800], preset: 800 }); // nothing kept from the server yet
  expect(canChoices({ ...stock, wet: UNKNOWN_WET }, null)).toEqual({ sizes: [], preset: null });
});

test("a portion is a whole number from 1 to 5000 grams", () => {
  expect(clampPortion(0)).toBe(1);
  expect(clampPortion(9000)).toBe(5000);
  expect(portionFor("wet", [], { wet: 7000, dry: null })).toBe(5000);
});

test("both kinds' stock in one form: what is left or that it ran out; a kind never entered stays out", () => {
  const stock: Stock = { wet: wetStock([can(400, 3), can(800, 2)]), dry: { grams: 1200, daysLeft: 1, belowZero: false } };
  expect(stockSummary(stock)).toBe("Nass: 3 × 400 g, 2 × 800 g · Trocken: 1,2 kg");
  expect(stockSummary({ wet: wetStock([can(400, 0)]), dry: { grams: null, daysLeft: null, belowZero: false } })).toBe("Nass: aufgebraucht");
  expect(stockSummary({ wet: UNKNOWN_WET, dry: { grams: null, daysLeft: null, belowZero: false } })).toBeNull();
});

test("a wet count as one thing: its title and its sizes", () => {
  expect(countTitle("2026-10-20T08:05:00.000Z", "Europe/Berlin")).toBe("Zählung vom 20.10., 10:05");
  expect(countLine([{ unitG: 400, amountG: 1200 }, { unitG: 800, amountG: 800 }])).toBe("3 × 400 g, 1 × 800 g");
  expect(countLine([{ unitG: 395, amountG: 592 }, { unitG: 800, amountG: 0 }])).toBe("1½ × 395 g, 0 × 800 g");
});
