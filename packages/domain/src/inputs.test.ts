import { expect, test } from "vitest";
import { messageFor, RESTOCK_MESSAGES, restockInput, STOCK_COUNT_MESSAGES, stockCountInput, weightInput } from "./inputs";

const message = (schema: typeof restockInput | typeof stockCountInput, messages: Record<string, string>, input: unknown) => {
  const r = schema.safeParse(input);
  return r.success ? null : messageFor(messages, r.error);
};

test("a wet count gives the cans per size, with a decimal comma for an opened can", () => {
  expect(stockCountInput.parse({ foodKind: "wet", sizes: [{ unitG: 400, cans: "2,5" }, { unitG: "800", cans: 0 }] })).toEqual({ foodKind: "wet", sizes: [{ unitG: 400, cans: 2.5 }, { unitG: 800, cans: 0 }] });
  expect(weightInput.parse({ kg: "12,4" }).kg).toBe(12.4);
  expect(message(stockCountInput, STOCK_COUNT_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: "zwei" }] })).toBe("Wie viele Dosen jeder Größe sind noch da?");
  expect(message(stockCountInput, STOCK_COUNT_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: "" }] })).toBe("Wie viele Dosen jeder Größe sind noch da?");
  expect(message(stockCountInput, STOCK_COUNT_MESSAGES, { foodKind: "wet", sizes: [] })).toBe("Wie viele Dosen jeder Größe sind noch da?");
  expect(message(stockCountInput, STOCK_COUNT_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: 1 }, { unitG: 400, cans: 2 }] })).toBe("Jede Dosengröße nur einmal.");
});

test("a wet restock is cans × grams per can", () => {
  expect(restockInput.parse({ foodKind: "wet", cans: "6", unitG: "800" })).toEqual({ foodKind: "wet", cans: 6, unitG: 800 });
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "wet", cans: 6 })).toBe("Wie viele Dosen, und wie viel Gramm hat eine Dose?");
});
