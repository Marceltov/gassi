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

test("dry food is entered in g or kg (with a decimal comma) and comes out in whole grams", () => {
  expect(restockInput.parse({ foodKind: "dry", amount: "1,5", unit: "kg" })).toEqual({ foodKind: "dry", grams: 1500 });
  expect(restockInput.parse({ foodKind: "dry", amount: "800", unit: "g" })).toEqual({ foodKind: "dry", grams: 800 });
  expect(restockInput.parse({ foodKind: "dry", amount: 12 })).toEqual({ foodKind: "dry", grams: 12 }); // grams unless it says kg
  expect(stockCountInput.parse({ foodKind: "dry", amount: "0,25", unit: "kg" })).toEqual({ foodKind: "dry", grams: 250 });
  expect(stockCountInput.parse({ foodKind: "dry", amount: "0", unit: "kg" })).toEqual({ foodKind: "dry", grams: 0 });
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "dry", amount: "0", unit: "kg" })).toBe("Wie viel hast du gekauft?");
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "dry", amount: "viel", unit: "kg" })).toBe("Wie viel hast du gekauft?");
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "dry", amount: "5", unit: "t" })).toBe("Gramm oder Kilogramm?");
  expect(message(stockCountInput, STOCK_COUNT_MESSAGES, { foodKind: "dry", amount: "", unit: "g" })).toBe("Wie viel ist noch da?");
});

test("what a check gives back passes the check again (the client sends it so)", () => {
  for (const input of [{ foodKind: "dry", amount: "1,5", unit: "kg" }, { foodKind: "wet", sizes: [{ unitG: "800", cans: "6" }] }]) {
    const once = restockInput.parse(input);
    expect(restockInput.parse(once)).toEqual(once);
  }
  for (const input of [{ foodKind: "dry", amount: "250", unit: "g" }, { foodKind: "wet", sizes: [{ unitG: 400, cans: "2,5" }] }]) {
    const once = stockCountInput.parse(input);
    expect(stockCountInput.parse(once)).toEqual(once);
  }
});

test("a wet restock is whole cans per size; sizes bought none of are left out", () => {
  expect(restockInput.parse({ foodKind: "wet", sizes: [{ unitG: "400", cans: "6" }, { unitG: 800, cans: 0 }] })).toEqual({ foodKind: "wet", sizes: [{ unitG: 400, cans: 6 }] });
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: 0 }] })).toBe("Wie viele Dosen welcher Größe hast du gekauft?");
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: 1.5 }] })).toBe("Wie viele Dosen welcher Größe hast du gekauft?");
  expect(message(restockInput, RESTOCK_MESSAGES, { foodKind: "wet", sizes: [{ unitG: 400, cans: 1 }, { unitG: 400, cans: 2 }] })).toBe("Jede Dosengröße nur einmal.");
});
