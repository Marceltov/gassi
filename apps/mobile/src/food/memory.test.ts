import { expect, test } from "vitest";
import { loadFacts, saveFacts, withFeeding } from "./memory";

test("the food sheet's facts are kept per person", () => {
  saveFacts("p-hirsch", { recent: [{ foodKind: "dry", amountG: 60 }], last: { wet: null, dry: 60 }, stock: null });
  expect(loadFacts("p-hirsch").recent).toEqual([{ foodKind: "dry", amountG: 60 }]);
  expect(loadFacts("p-herzii")).toEqual({ recent: [], last: null, stock: null });
});

test("a feeding just entered is the newest portion and its kind's last, so a second one offline starts from it", () => {
  const facts = { recent: [{ foodKind: "wet" as const, amountG: 200 }], last: { wet: 200, dry: 40 }, stock: null };
  expect(withFeeding(facts, { foodKind: "dry", amountG: 70 })).toEqual({ recent: [{ foodKind: "dry", amountG: 70 }, { foodKind: "wet", amountG: 200 }], last: { wet: 200, dry: 70 }, stock: null });
  expect(withFeeding({ recent: [], last: null, stock: null }, { foodKind: "wet", amountG: 150 }).last).toEqual({ wet: 150, dry: null });
});
