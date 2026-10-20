import { describe, expect, test } from "vitest";
import { freshDatabase, HERZII, HIRSCH } from "../db/testing";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const { json, tokenFor } = apiCaller(db, () => NOW);

describe("dogs over the API", () => {
  test("add, rename, archive; the list leaves archived dogs out unless asked", async () => {
    const token = await tokenFor(HIRSCH.id);
    const { body: bruno } = await json("/api/dogs", { method: "POST", token, body: { name: "Bruno", color: "#3a6fc0" } });
    expect(bruno).toEqual({ id: 2, name: "Bruno", color: "#3a6fc0", archived: false });
    await json(`/api/dogs/${bruno.id}`, { method: "PATCH", token, body: { archived: true } });
    expect((await json("/api/dogs", { token })).body.dogs.map((d: { name: string }) => d.name)).toEqual(["Toffee"]);
    expect((await json("/api/dogs?archived=1", { token })).body.dogs).toHaveLength(2);
    expect((await json("/api/dogs/99", { method: "PATCH", token, body: { name: "X" } })).status).toBe(404);
  });
});

describe("walks over the API", () => {
  test("both phones send their taps; the sessions view shows the joint walk", async () => {
    const hirsch = await tokenFor(HIRSCH.id);
    const herzii = await tokenFor(HERZII.id);
    const start = { id: "c1", at: "2026-10-20T09:00:00.000Z", kind: "walk.start", walkKey: "w" };
    const answer = await json("/api/commands", { method: "POST", token: hirsch, body: { commands: [start] } });
    expect(answer.body).toMatchObject({ applied: ["c1"], dropped: [], view: { walk: { key: "w", dogIds: [1], walkers: [HIRSCH] } } });
    await json("/api/commands", { method: "POST", token: herzii, body: { commands: [{ id: "c2", at: "2026-10-20T09:01:00.000Z", kind: "walk.join", walkKey: "w" }, { id: "c3", at: "2026-10-20T09:05:00.000Z", kind: "log", type: "pee", dogId: 1 }] } });
    expect((await json("/api/sessions", { token: hirsch })).body.walk.walkers).toEqual([HIRSCH, HERZII]);
  });

  test("invalid or too many commands are refused whole", async () => {
    const token = await tokenFor(HIRSCH.id);
    expect((await json("/api/commands", { method: "POST", token, body: { commands: [{ id: "x", at: "gestern", kind: "walk.start", walkKey: "w" }] } })).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, at: "2026-10-20T09:00:00.000Z", kind: "log", type: "pee", dogId: 1 }));
    expect((await json("/api/commands", { method: "POST", token, body: { commands: many } })).status).toBe(400);
  });
});

describe("entries over the API", () => {
  test("log, list with filters and paging, edit, delete", async () => {
    const token = await tokenFor(HIRSCH.id);
    const { body: food } = await json("/api/entries", { method: "POST", token, body: { type: "food", foodKind: "wet", amountG: 200, at: "2026-10-20T08:00:00Z" } });
    expect(food).toMatchObject({ type: "food", dogIds: [1], amountG: 200, byName: "Hirsch", loggedBy: HIRSCH.id });
    await json("/api/entries", { method: "POST", token, body: { type: "pee", at: "2026-10-20T08:30:00Z" } });
    expect((await json("/api/entries?type=food", { token })).body).toMatchObject({ entries: [{ id: food.id }], more: false });
    expect((await json("/api/entries?dog=1&day=2026-10-20", { token })).body.entries).toHaveLength(2);
    expect((await json(`/api/entries/${food.id}`, { method: "PATCH", token, body: { at: food.at, foodKind: "wet", amountG: 180, note: "halbe Dose" } })).body).toMatchObject({ amountG: 180, note: "halbe Dose" });
    expect((await json(`/api/entries/${food.id}`, { method: "DELETE", token })).body).toEqual({ deleted: true });
    expect((await json(`/api/entries/${food.id}`, { method: "DELETE", token })).status).toBe(404);
  });

  test("a German message for what doesn't fit", async () => {
    const token = await tokenFor(HIRSCH.id);
    expect(await json("/api/entries", { method: "POST", token, body: { type: "food", amountG: 200 } })).toEqual({ status: 400, body: { error: "Welche Futterart?" } });
  });
});
