import { describe, expect, test } from "vitest";
import type { Entry } from "./entry";
import { formatCans, formatWeight, parseDecimal } from "./food";
import { computeStock } from "./stock";

const NOW = Date.parse("2026-10-20T12:00:00Z");
let id = 0;
const day = (d: number, h = 8) => new Date(NOW - d * 86_400_000 + (h - 12) * 3_600_000).toISOString();
const e = (type: Entry["type"], at: string, more: Partial<Entry> = {}): Entry => ({
  id: ++id,
  dogIds: [1],
  type,
  at,
  endedAt: null,
  durationMin: null,
  amountG: null,
  foodKind: null,
  unitG: null,
  clientKey: null,
  note: null,
  loggedBy: "marcel",
  createdAt: at,
  updatedAt: at,
  ...more,
});
const restockWet = (at: string, cans: number, unitG: number) => e("restock", at, { foodKind: "wet", amountG: cans * unitG, unitG });
const feed = (at: string, kind: "wet" | "dry", g: number) => e("food", at, { foodKind: kind, amountG: g });
const stock = (entries: Entry[], treats: { at: string; grams: number }[] = []) => computeStock({ entries, treats, now: NOW });
const wetOf = (s: ReturnType<typeof stock>) => s.wet.sizes.map((x) => [x.unitG, x.cans]);
const check = (at: string, unitG: number, cans: number) => e("stockcheck", at, { foodKind: "wet", amountG: cans * unitG, unitG });
const feedCan = (at: string, g: number, unitG: number) => e("food", at, { foodKind: "wet", amountG: g, unitG }); // older data named a can
const opened = (at: string, unitG: number) => e("opened", at, { foodKind: "wet", amountG: unitG, unitG, dogIds: [] });
describe("wet food in closed cans", () => {
  test("wet food counts closed cans: count + bought − opened; feedings don't count", () => {
    const s = stock([check(day(5), 400, 3), restockWet(day(4), 2, 400), opened(day(3), 400), feedCan(day(3), 300, 400)]);
    expect(s.wet.sizes).toMatchObject([{ unitG: 400, cans: 4 }]);
  });

  test("an old count with halves shows whole cans", () => {
    expect(wetOf(stock([e("stockcheck", day(2), { foodKind: "wet", amountG: 1000, unitG: 400 })]))).toEqual([[400, 2]]);
  });

  test("opening a size with no cans left counts below zero", () => {
    const s = stock([check(day(2), 400, 0), check(day(2), 800, 1), opened(day(1), 400)]);
    expect(s.wet.sizes.find((x) => x.unitG === 400)).toMatchObject({ cans: 0, belowZero: true });
  });

  test("reicht etwa: closed cans' grams over the wet grams fed per day", () => {
    const fed = Array.from({ length: 14 }, (_, d) => feed(day(d + 1), "wet", 400));
    expect(stock([check(day(20), 400, 10), ...fed]).wet.daysLeft).toBe(10);
  });
});

describe("computeStock", () => {
  test("no restock means unknown", () => {
    expect(stock([feed(day(1), "wet", 200)])).toEqual({
      wet: { grams: null, sizes: [], newestUnitG: null, daysLeft: null, belowZero: false },
      dry: { grams: null, daysLeft: null, belowZero: false },
    });
  });

  test("12 cans à 400 g minus 1 opened is 11 cans; wet feedings don't count", () => {
    const s = stock([feed(day(5), "wet", 200), restockWet(day(3), 12, 400), opened(day(2), 400), feed(day(2), "wet", 200), feed(day(1), "dry", 80)]);
    expect(s.wet).toMatchObject({ grams: 4400, sizes: [{ unitG: 400, grams: 4400, cans: 11, belowZero: false, lastAt: day(3) }], newestUnitG: 400, belowZero: false });
    expect(s.dry.grams).toBeNull();
  });

  test("cans of 400 g and 800 g are counted apart, with a total", () => {
    const s = stock([restockWet(day(5), 4, 400), restockWet(day(4), 2, 800), opened(day(3), 400), opened(day(2), 800)]);
    expect(wetOf(s)).toEqual([[400, 3], [800, 1]]);
    expect(s.wet).toMatchObject({ grams: 1200 + 800, newestUnitG: 800 });
  });

  test("dry treats count against dry food", () => {
    const s = stock([e("restock", day(3), { foodKind: "dry", amountG: 10_000 }), feed(day(1), "dry", 80)], [{ at: day(1), grams: 5 }, { at: day(4), grams: 50 }]);
    expect(s.dry.grams).toBe(10_000 - 80 - 5);
  });

  test("a dry stockcheck resets the count", () => {
    const s = stock([e("restock", day(10), { foodKind: "dry", amountG: 5000 }), feed(day(5), "dry", 2000), e("stockcheck", day(3), { foodKind: "dry", amountG: 2000 }), feed(day(2), "dry", 400)]);
    expect(s.dry.grams).toBe(1600);
  });

  test("a wet count sets every size at once: a size left out is 0 (and retired), later restocks and opened cans count on", () => {
    const s = stock([restockWet(day(10), 12, 400), restockWet(day(9), 3, 800), opened(day(5), 400), check(day(3), 400, 5), opened(day(2), 400), restockWet(day(1), 6, 400)]);
    expect(wetOf(s)).toEqual([[400, 10]]);
    expect(s.wet.grams).toBe(4000);
  });

  test("a wet count works without any purchase, and a new size starts there", () => {
    const at = day(2);
    const s = stock([check(at, 400, 2), check(at, 800, 1), opened(day(1), 800)]);
    expect(wetOf(s)).toEqual([[400, 2], [800, 0]]);
    expect(s.wet).toMatchObject({ grams: 800, newestUnitG: null });
  });

  test("an older count is replaced by the newest one as a whole", () => {
    const s = stock([check(day(5), 400, 3), check(day(5), 800, 2), check(day(2), 400, 1)]);
    expect(wetOf(s)).toEqual([[400, 1]]);
  });

  test("a size counted to 0 is retired; bought, counted or opened after the count it is back", () => {
    const at = day(5);
    const counted = [restockWet(day(9), 1, 10_000), restockWet(day(8), 4, 400), check(at, 10_000, 0), check(at, 400, 3)];
    expect(wetOf(stock(counted))).toEqual([[400, 3]]); // the mistaken 10000 g can is gone
    expect(wetOf(stock([...counted, restockWet(day(2), 1, 10_000)]))).toEqual([[400, 3], [10_000, 1]]);
    expect(stock([...counted, opened(day(2), 10_000)]).wet.sizes.map((x) => x.unitG)).toEqual([400, 10_000]);
  });

  test("each size knows when it was last bought or counted with cans", () => {
    const s = stock([restockWet(day(5), 2, 400), check(day(3), 400, 1), check(day(3), 800, 1), restockWet(day(2), 1, 800), opened(day(1), 800)]);
    expect(s.wet.sizes.map((x) => [x.unitG, x.lastAt])).toEqual([[400, day(3)], [800, day(2)]]);
  });

  test("a size opened down to 0 without a count stays, to be bought again", () => {
    expect(wetOf(stock([restockWet(day(5), 1, 800), restockWet(day(4), 2, 400), opened(day(2), 800)]))).toEqual([[400, 2], [800, 0]]);
  });

  test("a stockcheck of zero is a known, empty stock", () => {
    expect(stock([e("stockcheck", day(1), { foodKind: "dry", amountG: 0 })]).dry).toEqual({ grams: 0, daysLeft: null, belowZero: false });
    expect(stock([check(day(1), 400, 0)]).wet).toMatchObject({ grams: 0, sizes: [] });
  });

  test("negative stock is clamped, per size", () => {
    const s = stock([restockWet(day(4), 1, 400), restockWet(day(3), 1, 800), opened(day(2), 400), opened(day(1), 400)]);
    expect(s.wet.sizes).toEqual([{ unitG: 400, grams: 0, cans: 0, belowZero: true, lastAt: day(4) }, { unitG: 800, grams: 800, cans: 1, belowZero: false, lastAt: day(3) }]);
    expect(s.wet).toMatchObject({ grams: 800, belowZero: true });
  });

  test("in the first days, days left divide by the days covered, not by 14", () => {
    // restocked 2 days ago, 200 g a day since: 7600 g closed lasts 38 days, not 7600 / (400 / 14) = 266
    const s = stock([restockWet(day(2, 12), 20, 400), opened(day(1), 400), feed(day(1), "wet", 200), feed(day(0, 9), "wet", 200)]);
    expect(s.wet.grams).toBe(7600);
    expect(s.wet.daysLeft).toBe(38);
  });

  test("days left from the last 14 days, over all sizes", () => {
    // 14 days × 200 g = 2800 g used in the window → 200 g a day; one older feeding doesn't count
    const feedings = Array.from({ length: 14 }, (_, d) => feed(day(d, 9), "wet", 200));
    const s = stock([restockWet(day(31), 10, 800), restockWet(day(30), 20, 400), feed(day(20), "wet", 1000), ...feedings]);
    expect(s.wet.grams).toBe(8000 + 8000);
    expect(s.wet.daysLeft).toBe(80);
  });
});
test("formatCans", () => {
  expect(formatCans(11)).toBe("11 Dosen");
  expect(formatCans(1)).toBe("1 Dose");
  expect(formatCans(0)).toBe("0 Dosen");
});
test("formatWeight", () => {
  expect(formatWeight(4400)).toBe("4,4 kg");
  expect(formatWeight(10_000)).toBe("10 kg");
  expect(formatWeight(800)).toBe("800 g");
  // halves of odd can sizes leave half grams: they show rounded
  expect(formatWeight(450.5)).toBe("451 g");
  expect(formatWeight(1997.5)).toBe("2 kg");
  expect(formatWeight(2370.5)).toBe("2,4 kg");
});
test("parseDecimal reads German and English decimals, empty is not a number", () => {
  expect(parseDecimal("7,5")).toBe(7.5);
  expect(parseDecimal(" 0.5 ")).toBe(0.5);
  expect(parseDecimal("")).toBeNaN();
  expect(parseDecimal("viel")).toBeNaN();
});
