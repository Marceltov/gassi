import { expect, test } from "vitest";
import { messageFor, STOCK_COUNT_MESSAGES, stockCountInput, weightInput } from "./inputs";

test("a count of cans takes a decimal comma, like a weight; grams stay whole", () => {
  expect(stockCountInput.parse({ foodKind: "wet", cans: "2,5" })).toEqual({ foodKind: "wet", cans: 2.5 });
  expect(stockCountInput.parse({ foodKind: "wet", cans: 3 })).toEqual({ foodKind: "wet", cans: 3 });
  expect(stockCountInput.parse({ foodKind: "dry", grams: "800" })).toEqual({ foodKind: "dry", grams: 800 });
  expect(weightInput.parse({ kg: "12,4" }).kg).toBe(12.4);
  const bad = stockCountInput.safeParse({ foodKind: "wet", cans: "zwei" });
  expect(bad.success).toBe(false);
  if (!bad.success) expect(messageFor(STOCK_COUNT_MESSAGES, bad.error)).toBe("Wie viele Dosen sind noch da?");
  expect(stockCountInput.safeParse({ foodKind: "wet", cans: "" }).success).toBe(false);
});
