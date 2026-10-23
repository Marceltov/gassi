import { expect, test } from "vitest";
import { buyingSizes, countWeight, clampPortion, countLine, formSizes, mergeSizes, stillHidden, countTitle, formatCanCount, perDog, portionFor, prefillFood, quickPortions, stockParts, stockSummary } from "./food";
import type { CanStock, Stock, WetStock } from "./stock";

const can = (unitG: number, cans: number): CanStock => ({ unitG, grams: cans * unitG, cans, belowZero: false, lastAt: null });
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

test("quick amounts: recent portions of the kind without repeats, at most four", () => {
  const recent = [wet(80), dry(50), wet(80), wet(40), wet(95), wet(60), wet(70)];
  expect(quickPortions(recent, "wet")).toEqual([{ label: "80 g", amountG: 80 }, { label: "40 g", amountG: 40 }, { label: "95 g", amountG: 95 }, { label: "60 g", amountG: 60 }]);
  expect(quickPortions(recent, "dry")).toEqual([{ label: "50 g", amountG: 50 }]);
});

test("per dog: a feeding's grams shared by its dogs", () => {
  expect(perDog(400, 2)).toBe(200);
  expect(perDog(395, 2)).toBe(198);
  expect(perDog(120, 1)).toBe(120);
  expect(perDog(120, 0)).toBe(120); // a feeding always has a dog; nothing to share by otherwise
});

test("a can size's count: whole and half cans × grams", () => {
  expect(formatCanCount(can(400, 3))).toBe("3 × 400 g");
  expect(formatCanCount(can(800, 2.5))).toBe("2½ × 800 g");
  expect(formatCanCount(can(400, 0.5))).toBe("½ × 400 g");
  expect(formatCanCount(can(400, 2.75))).toBe("2¾ × 400 g");
  expect(formatCanCount(can(400, 1.25))).toBe("1¼ × 400 g");
});

test("the stock in parts, for the stock screen: per can size, the total, for how long, and whether it ran out", () => {
  const stock: Stock = { wet: wetStock([can(400, 3), can(800, 2)], { daysLeft: 9.2 }), dry: { grams: 300, daysLeft: 0.4, belowZero: false } };
  expect(stockParts(stock, "wet")).toEqual({ left: "3 × 400 g · 2 × 800 g", sizes: ["3 × 400 g", "2 × 800 g"], amount: "2,8 kg", lasts: "reicht etwa 9 Tage", empty: false });
  expect(stockParts({ ...stock, wet: wetStock([can(400, 0), can(800, 2.5)]) }, "wet")).toMatchObject({ sizes: ["2½ × 800 g"], amount: "2 kg" });
  expect(stockParts(stock, "dry")).toEqual({ left: "300 g", sizes: [], amount: "300 g", lasts: "reicht weniger als einen Tag", empty: false });
  expect(stockParts({ ...stock, dry: { grams: null, daysLeft: null, belowZero: false } }, "dry")).toEqual({ left: null, sizes: [], amount: null, lasts: null, empty: false });
  expect(stockParts({ ...stock, dry: { grams: 0, daysLeft: 0, belowZero: true } }, "dry")).toMatchObject({ left: "0 g", lasts: null, empty: true });
  expect(stockParts({ ...stock, wet: UNKNOWN_WET }, "wet")).toEqual({ left: null, sizes: [], amount: null, lasts: null, empty: false });
  // one size below zero doesn't make the other run out
  expect(stockParts({ ...stock, wet: wetStock([{ ...can(400, 0), belowZero: true }, can(800, 1)], { belowZero: true }) }, "wet")).toMatchObject({ sizes: ["1 × 800 g"], empty: false });
  expect(stockParts({ ...stock, wet: wetStock([can(400, 0)]) }, "wet")).toMatchObject({ left: "0 Dosen", empty: true, amount: "0 g" });
});

test("a wet count comes to its cans times their sizes, as typed; not while a count isn't a number", () => {
  expect(countWeight([{ unitG: 400, cans: "2,75" }, { unitG: 800, cans: "1" }])).toBe("1,9 kg");
  expect(countWeight([{ unitG: 400, cans: "0" }])).toBe("0 g");
  expect(countWeight([{ unitG: 400, cans: "zwei" }])).toBeNull();
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

test("rows of the same can size add up (a new row typed with a known size)", () => {
  expect(mergeSizes([{ unitG: 400, cans: 2 }, { unitG: 800, cans: 1 }, { unitG: 400, cans: 1.5 }])).toEqual([{ unitG: 400, cans: 3.5 }, { unitG: 800, cans: 1 }]);
});

test("the stock screen's rows by their (maybe edited) sizes: counting, a known size in no row is 0; rows without a size stay out", () => {
  const rows = [
    { size: "1000", cans: "2" }, // was 10000 g, corrected
    { size: "400", cans: "3" },
    { size: "", cans: "1" }, // no size: not recorded
    { size: "abc", cans: "1" },
  ];
  expect(formSizes([10_000, 400], rows, true)).toEqual({ sizes: [{ unitG: 1000, cans: "2" }, { unitG: 400, cans: "3" }, { unitG: 10_000, cans: "0" }], unsized: 2 });
  // buying: an edited size only changes what is bought
  expect(formSizes([10_000, 400], rows, false)).toEqual({ sizes: [{ unitG: 1000, cans: "2" }, { unitG: 400, cans: "3" }], unsized: 2 });
  expect(formSizes([400], [{ size: " 400 ", cans: "1" }, { size: "400", cans: "2" }], true).sizes).toEqual([{ unitG: 400, cans: "1" }, { unitG: 400, cans: "2" }]); // they add up in the input
  expect(formSizes([400], [{ size: "10001", cans: "1" }, { size: "0", cans: "1" }], false).unsized).toBe(2);
});

test("a size hidden from the purchase rows stays hidden until it is bought or counted with cans again", () => {
  const seen = "2026-10-19T08:00:00.000Z";
  const sized = (lastAt: string | null) => ({ ...can(800, 2), lastAt });
  const stock: Stock = { wet: wetStock([can(400, 1), sized(seen)]), dry: { grams: null, daysLeft: null, belowZero: false } };
  const hidden = [{ unitG: 800, seenLastAt: seen }];
  expect(buyingSizes(stock, hidden)).toEqual([400]); // the stock keeps its cans; only the row goes
  expect(stock.wet.sizes.find((x) => x.unitG === 800)?.cans).toBe(2);
  // bought again since: its time (the server's) is another one, so it is back
  const later: Stock = { ...stock, wet: wetStock([can(400, 1), sized("2026-10-20T11:00:00.000Z")]) };
  expect(buyingSizes(later, hidden)).toEqual([400, 800]);
  expect(stillHidden(later, hidden)).toEqual([]);
  // never bought or counted with cans: hidden as seen (null), and stays so
  const never: Stock = { ...stock, wet: wetStock([can(400, 1), sized(null)]) };
  expect(buyingSizes(never, [{ unitG: 800, seenLastAt: null }])).toEqual([400]);
});
