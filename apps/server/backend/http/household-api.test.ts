import { describe, expect, test } from "vitest";
import { freshDatabase, HIRSCH } from "../db/testing";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T12:00:00Z");
const { json, tokenFor } = apiCaller(db, () => NOW);

describe("the household's lists over the API", () => {
  test("catalog round trip: exercises and treat kinds", async () => {
    const token = await tokenFor(HIRSCH.id);
    const { body: sitz } = await json("/api/exercises", { method: "POST", token, body: { name: "Sitz" } });
    await json(`/api/exercises/${sitz.id}`, { method: "PATCH", token, body: { name: "Sitz!" } });
    expect((await json("/api/exercises", { token })).body).toEqual({ exercises: [{ id: sitz.id, name: "Sitz!" }] });
    await json(`/api/exercises/${sitz.id}`, { method: "PATCH", token, body: { archived: true } });
    expect((await json("/api/exercises", { token })).body.exercises).toEqual([]);
    const { body: kaese } = await json("/api/treat-kinds", { method: "POST", token, body: { name: "Käse", gramsPerPiece: 2, fromDry: false } });
    await json(`/api/treat-kinds/${kaese.id}`, { method: "PATCH", token, body: { name: "Käse", gramsPerPiece: 3, fromDry: false } });
    expect((await json("/api/treat-kinds", { token })).body.treatKinds).toEqual([{ id: kaese.id, name: "Käse", gramsPerPiece: 3, fromDry: false }]);
    expect((await json("/api/exercises", { method: "POST", token, body: { name: "" } })).status).toBe(400);
  });
});

describe("food, weight and the week over the API", () => {
  test("stock after restock and an opened can; the usual portion", async () => {
    const token = await tokenFor(HIRSCH.id);
    await json("/api/stock/restock", { method: "POST", token, body: { foodKind: "wet", sizes: [{ unitG: 400, cans: 12 }] } });
    await json("/api/entries", { method: "POST", token, body: { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T12:00:00Z" } });
    await json("/api/entries", { method: "POST", token, body: { type: "opened", foodKind: "wet", amountG: 400, unitG: 400, at: "2026-10-20T12:00:00Z" } });
    expect((await json("/api/stock", { token })).body).toMatchObject({ wet: { grams: 4400, sizes: [{ unitG: 400, cans: 11 }], newestUnitG: 400 }, dry: { grams: null } });
    expect((await json("/api/food/last", { token })).body).toEqual({ wet: 200, dry: null });
    const count = await json("/api/stock/correct", { method: "POST", token, body: { foodKind: "wet", sizes: [{ unitG: 400, cans: 5 }, { unitG: 800, cans: "1" }] } });
    expect(count.body.entries).toHaveLength(2);
    expect((await json("/api/stock", { token })).body.wet).toMatchObject({ grams: 2800, sizes: [{ unitG: 400, cans: 5 }, { unitG: 800, cans: 1 }] });
  });

  test("weight in kg for the dog; the list of weights", async () => {
    const token = await tokenFor(HIRSCH.id);
    expect((await json("/api/weight", { method: "POST", token, body: { kg: "12,4", at: "2026-10-20T08:00:00Z" } })).body).toMatchObject({ type: "weight", amountG: 12_400, dogIds: [1] });
    expect((await json("/api/weight", { token })).body.weights).toHaveLength(1);
  });

  test("week has today's walk", async () => {
    const token = await tokenFor(HIRSCH.id);
    await json("/api/entries", { method: "POST", token, body: { type: "walk", at: "2026-10-20T08:00:00Z", endedAt: "2026-10-20T08:40:00Z" } });
    const { body } = await json("/api/week?w=2026-10-20", { token });
    expect(body.monday).toBe("2026-10-19");
    expect(body.days[1].bars).toEqual([{ type: "walk", startMin: 600, endMin: 640 }]);
    expect(body.byPerson).toMatchObject([{ id: HIRSCH.id, name: "Hirsch", walks: 1, walkMin: 40, km: 0 }]);
  });
});
