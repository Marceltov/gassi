import { describe, expect, test } from "vitest";
import type { Entry } from "./entries/model";
import { Catalog } from "./catalog";
import { freshDatabase } from "./db/testing";
import { Sessions } from "./sessions";
import { formatCans, formatWeight, parseDecimal } from "@gassi/domain";
import { computeStock, dryTreats } from "./stock";

const NOW = Date.parse("2026-10-20T12:00:00Z");
let id = 0;
const day = (d: number, h = 8) => new Date(NOW - d * 86_400_000 + (h - 12) * 3_600_000).toISOString();
const e = (type: Entry["type"], at: string, more: Partial<Entry> = {}): Entry => ({
  id: ++id,
  dogId: 1,
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

describe("computeStock", () => {
  test("no restock means unknown", () => {
    expect(stock([feed(day(1), "wet", 200)])).toEqual({
      wet: { grams: null, cans: null, canSizeG: null, daysLeft: null, belowZero: false },
      dry: { grams: null, daysLeft: null, belowZero: false },
    });
  });

  test("12 cans à 400 g minus 2 feedings of 200 g is 11 cans", () => {
    const s = stock([feed(day(5), "wet", 200), restockWet(day(3), 12, 400), feed(day(2), "wet", 200), feed(day(1), "wet", 200), feed(day(1), "dry", 80)]);
    expect(s.wet).toMatchObject({ grams: 4400, cans: 11, canSizeG: 400, belowZero: false });
    expect(s.dry.grams).toBeNull();
  });

  test("cans are rounded down to halves", () => {
    expect(stock([restockWet(day(3), 2, 400), feed(day(1), "wet", 150)]).wet.cans).toBe(1.5);
    expect(stock([restockWet(day(3), 2, 400), feed(day(1), "wet", 250)]).wet.cans).toBe(1);
  });

  test("dry treats count against dry food", () => {
    const s = stock([e("restock", day(3), { foodKind: "dry", amountG: 10_000 }), feed(day(1), "dry", 80)], [{ at: day(1), grams: 5 }, { at: day(4), grams: 50 }]);
    expect(s.dry.grams).toBe(10_000 - 80 - 5);
  });

  test("stockcheck resets the count", () => {
    const s = stock([restockWet(day(10), 12, 400), feed(day(5), "wet", 2000), e("stockcheck", day(3), { foodKind: "wet", amountG: 2000 }), feed(day(2), "wet", 400), restockWet(day(1), 6, 400)]);
    expect(s.wet).toMatchObject({ grams: 2000 - 400 + 2400, cans: 10 });
  });

  test("a stockcheck of zero is a known, empty stock", () => {
    expect(stock([e("stockcheck", day(1), { foodKind: "dry", amountG: 0 })]).dry).toEqual({ grams: 0, daysLeft: null, belowZero: false });
  });

  test("negative stock is clamped", () => {
    const s = stock([restockWet(day(3), 1, 400), feed(day(2), "wet", 300), feed(day(1), "wet", 300)]);
    expect(s.wet).toMatchObject({ grams: 0, cans: 0, belowZero: true });
  });

  test("in the first days, days left divide by the days covered, not by 14", () => {
    // restocked 2 days ago, 200 g a day since: 7600 g left lasts 38 days, not 7600 / (400 / 14) = 266
    const s = stock([restockWet(day(2, 12), 20, 400), feed(day(1), "wet", 200), feed(day(0, 9), "wet", 200)]);
    expect(s.wet.grams).toBe(7600);
    expect(s.wet.daysLeft).toBe(38);
  });

  test("days left from the last 14 days", () => {
    // 14 days × 200 g = 2800 g used in the window → 200 g a day; one older feeding doesn't count
    const feedings = Array.from({ length: 14 }, (_, d) => feed(day(d, 9), "wet", 200));
    const s = stock([restockWet(day(30), 20, 400), feed(day(20), "wet", 1000), ...feedings]);
    expect(s.wet.grams).toBe(8000 - 1000 - 2800);
    expect(s.wet.daysLeft).toBe(21);
  });
});

test("formatCans", () => {
  expect(formatCans(11.5)).toBe("11½ Dosen");
  expect(formatCans(1)).toBe("1 Dose");
  expect(formatCans(0.5)).toBe("½ Dose");
  expect(formatCans(0)).toBe("0 Dosen");
});

test("formatWeight", () => {
  expect(formatWeight(4400)).toBe("4,4 kg");
  expect(formatWeight(10_000)).toBe("10 kg");
  expect(formatWeight(800)).toBe("800 g");
});

describe("dryTreats", () => {
  const { db } = freshDatabase();
  test("only treats that come out of the dry food, as grams at the training's time", async () => {
    const c = new Catalog(db());
    const dry = await c.addTreatKind({ name: "Trockenfutter-Stück", gramsPerPiece: 0.5, fromDry: true });
    const cheese = await c.addTreatKind({ name: "Käse", gramsPerPiece: 2, fromDry: false });
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map(), now: () => new Date(NOW) });
    await s.apply({ username: "bille", name: "Herzii" }, [
      { id: "1", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" },
      ...[1, 2, 3, 4].map((n) => ({ id: `d${n}`, at: `2026-10-20T09:0${n}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: dry.id, delta: 1 as const })),
      { id: "c", at: "2026-10-20T09:05:00.000Z", kind: "training.treat", trainingKey: "t", treatKindId: cheese.id, delta: 1 },
    ]);
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 2 }]);
  });

  test("changing a treat kind later doesn't change what past treats weighed or where they came from", async () => {
    const c = new Catalog(db());
    const dry = await c.addTreatKind({ name: "Stück", gramsPerPiece: 0.5, fromDry: true });
    const s = new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map(), now: () => new Date(NOW) });
    const treat = (id: string, minute: number) => ({ id, at: `2026-10-20T09:0${minute}:00.000Z`, kind: "training.treat" as const, trainingKey: "t", treatKindId: dry.id, delta: 1 as const });
    await s.apply({ username: "bille", name: "Herzii" }, [{ id: "1", at: "2026-10-20T09:00:00.000Z", kind: "training.start", trainingKey: "t" }, treat("a", 1), treat("b", 2)]);
    await c.updateTreatKind(dry.id, { name: "Stück", gramsPerPiece: 3, fromDry: true });
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 1 }]);
    await c.updateTreatKind(dry.id, { name: "Stück", gramsPerPiece: 3, fromDry: false });
    expect(await dryTreats(db())).toEqual([{ at: "2026-10-20T09:00:00.000Z", grams: 1 }]);
  });
});

test("parseDecimal reads German and English decimals, empty is not a number", () => {
  expect(parseDecimal("7,5")).toBe(7.5);
  expect(parseDecimal(" 0.5 ")).toBe(0.5);
  expect(parseDecimal("")).toBeNaN();
  expect(parseDecimal("viel")).toBeNaN();
});
