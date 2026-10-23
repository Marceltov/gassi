import { afterEach, expect, test, vi } from "vitest";
import { commandSchema, newId } from "./commands";

const at = "2026-10-20T09:00:00.000Z";

test("pee and poop name their one dog; walks and trainings may name dogs", () => {
  expect(commandSchema.safeParse({ id: "1", at, kind: "log", type: "pee" }).success).toBe(false);
  expect(commandSchema.parse({ id: "1", at, kind: "log", type: "pee", dogId: 2 })).toMatchObject({ dogId: 2 });
  expect(commandSchema.parse({ id: "2", at, kind: "walk.start", walkKey: "w", dogIds: [1, 2] })).toMatchObject({ dogIds: [1, 2] });
  expect(commandSchema.parse({ id: "3", at, kind: "walk.start", walkKey: "w" })).not.toHaveProperty("dogIds");
  expect(commandSchema.parse({ id: "4", at, kind: "training.start", trainingKey: "t", dogIds: [3] })).toMatchObject({ dogIds: [3] });
});

test("a food command needs a sensible amount and a kind of wet or dry", () => {
  const food = { id: "1", at, kind: "food", amountG: 80, foodKind: "wet" };
  expect(commandSchema.parse(food)).toMatchObject({ amountG: 80, foodKind: "wet" });
  expect(commandSchema.parse(food)).not.toHaveProperty("dogIds");
  expect(commandSchema.safeParse({ ...food, amountG: 0 }).success).toBe(false);
  expect(commandSchema.safeParse({ ...food, amountG: 5001 }).success).toBe(false);
  expect(commandSchema.safeParse({ ...food, foodKind: "raw" }).success).toBe(false);
  // a wet feeding may name the can size it came out of
  expect(commandSchema.parse({ ...food, unitG: 800 })).not.toHaveProperty("unitG"); // a feeding names no can
});

afterEach(() => vi.unstubAllGlobals());
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("new ids are UUIDs, also where the browser has no randomUUID (plain http on a home network)", () => {
  expect(newId()).toMatch(UUID_V4);
  const real = globalThis.crypto;
  vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
  const ids = new Set(Array.from({ length: 50 }, () => newId()));
  expect(ids.size).toBe(50);
  for (const id of ids) expect(id).toMatch(UUID_V4);
});
