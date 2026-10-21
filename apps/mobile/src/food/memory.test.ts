import { expect, test } from "vitest";
import { loadFacts, saveFacts, withFeeding } from "./memory";

test("the food sheet's facts are kept per person", () => {
  saveFacts("p-hirsch", { recent: [{ foodKind: "dry", amountG: 60 }], last: { wet: null, dry: 60, wetUnitG: null }, stock: null });
  expect(loadFacts("p-hirsch").recent).toEqual([{ foodKind: "dry", amountG: 60 }]);
  expect(loadFacts("p-herzii")).toEqual({ recent: [], last: null, stock: null });
});

test("a stock kept before the can sizes is dropped, the rest stays", () => {
  const old = { wet: { grams: 400, cans: 1, canSizeG: 400, daysLeft: null, belowZero: false }, dry: { grams: null, daysLeft: null, belowZero: false } };
  saveFacts("p-old", { recent: [{ foodKind: "wet", amountG: 60 }], last: { wet: 60, dry: null, wetUnitG: null }, stock: old as never });
  expect(loadFacts("p-old")).toMatchObject({ recent: [{ foodKind: "wet", amountG: 60 }], stock: null });
});

test("a feeding just entered is the newest portion and its kind's last, so a second one offline starts from it", () => {
  const facts = { recent: [{ foodKind: "wet" as const, amountG: 200 }], last: { wet: 200, dry: 40, wetUnitG: 400 }, stock: null };
  expect(withFeeding(facts, { foodKind: "dry", amountG: 70 })).toEqual({ recent: [{ foodKind: "dry", amountG: 70 }, { foodKind: "wet", amountG: 200 }], last: { wet: 200, dry: 70, wetUnitG: 400 }, stock: null });
  expect(withFeeding({ recent: [], last: null, stock: null }, { foodKind: "wet", amountG: 150 }).last).toEqual({ wet: 150, dry: null, wetUnitG: null });
  // and the can it came out of is the one to start with next time
  expect(withFeeding(facts, { foodKind: "wet", amountG: 400 }, 800).last).toEqual({ wet: 400, dry: 40, wetUnitG: 800 });
});
