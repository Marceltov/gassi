import { expect, test } from "vitest";
import { portionFor, prefillFood, quickPortions, stockLine } from "./food";
import type { Stock } from "./stock";

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

test("the stock line says what is left and for how long", () => {
  const stock: Stock = { wet: { grams: 3600, cans: 9, canSizeG: 400, daysLeft: 12.4, belowZero: false }, dry: { grams: 1200, daysLeft: 1, belowZero: false } };
  expect(stockLine(stock, "wet")).toBe("noch 9 Dosen · reicht etwa 12 Tage");
  expect(stockLine(stock, "dry")).toBe("noch 1,2 kg · reicht etwa 1 Tag");
  expect(stockLine({ ...stock, dry: { grams: null, daysLeft: null, belowZero: false } }, "dry")).toBeNull();
  expect(stockLine({ ...stock, dry: { grams: 0, daysLeft: 0, belowZero: true } }, "dry")).toBe("Vorrat aufgebraucht");
});
