import { describe, expect, test } from "vitest";
import { parseUsers } from "./config";
import { freshDatabase } from "./db/testing";
import { Diary, HISTORY_PAGE, historyFilter, InputError } from "./diary";

const { db } = freshDatabase();
const HIRSCH = { username: "marcel", name: "Hirsch" };
let clock = new Date("2026-10-20T10:00:00Z");
const diary = () => new Diary({ db: db(), dog: { id: 1, name: "Toffee" }, users: parseUsers("marcel:Hirsch,bille:Herzii"), timeZone: "Europe/Berlin", now: () => clock });

describe("log", () => {
  test("logs for the signed-in user and shows their display name", async () => {
    const e = await diary().log(HIRSCH, { type: "food", at: "2026-10-20T09:00:00Z", amountG: "200", note: "  " });
    expect(e).toMatchObject({ type: "food", at: "2026-10-20T09:00:00.000Z", amountG: 200, note: null, loggedBy: "marcel", byName: "Hirsch" });
  });

  test.each([
    [{ type: "walk", at: "gestern" }, "Die Zeit fehlt oder stimmt nicht."],
    [{ type: "walk", at: "2026-10-20T09:00:00Z", durationMin: "1.5" }, /Dauer/],
    [{ type: "food", at: "2026-10-20T09:00:00Z", amountG: -1 }, /Menge/],
    [{ type: "bark", at: "2026-10-20T09:00:00Z" }, /Art/],
  ])("rejects %j", async (input, message) => {
    await expect(diary().log(HIRSCH, input)).rejects.toBeInstanceOf(InputError);
    await expect(diary().log(HIRSCH, input)).rejects.toThrow(message);
  });

  test("logAs takes only people in USERS", async () => {
    expect(await diary().logAs("bille", { type: "pee", at: "2026-10-20T09:00:00Z" })).toMatchObject({ byName: "Herzii" });
    await expect(diary().logAs("mallory", { type: "pee", at: "2026-10-20T09:00:00Z" })).rejects.toThrow(InputError);
  });
});

describe("today", () => {
  test("has today's entries in Berlin and the latest of each tile type", async () => {
    clock = new Date("2026-10-20T22:30:00Z"); // 00:30 on the 21st in Berlin
    const d = diary();
    await d.log(HIRSCH, { type: "walk", at: "2026-10-20T21:30:00Z" }); // 23:30 on the 20th
    const pee1 = await d.log(HIRSCH, { type: "pee", at: "2026-10-20T22:05:00Z" });
    const pee2 = await d.logAs("bille", { type: "pee", at: "2026-10-20T22:20:00Z" });
    const today = await d.today();
    expect(today.entries.map((e) => e.id)).toEqual([pee2.id, pee1.id]);
    expect(today.tiles).toEqual({ walk: null, food: null, pee: pee2, poop: null });
    expect(today).toMatchObject({ dogName: "Toffee", timeZone: "Europe/Berlin", now: clock.toISOString() });
  });
});

test("edit changes the fields, remove deletes", async () => {
  const d = diary();
  const e = await d.log(HIRSCH, { type: "walk", at: "2026-10-20T09:00:00Z" });
  expect(await d.edit(e.id, { at: "2026-10-20T08:00:00Z", durationMin: 40 })).toMatchObject({ at: "2026-10-20T08:00:00.000Z", durationMin: 40 });
  expect(await d.edit(999, { at: "2026-10-20T08:00:00Z" })).toBeNull();
  expect(await d.remove(e.id)).toBe(true);
  expect(await d.all()).toEqual([]);
});

test("history pages by 50 and says when there is more", async () => {
  const d = diary();
  for (let i = 0; i < HISTORY_PAGE + 1; i++) await d.log(HIRSCH, { type: "walk", at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() });
  await d.logAs("bille", { type: "food", at: "2026-10-02T00:00:00Z" });
  const first = await d.history({});
  expect(first.entries).toHaveLength(HISTORY_PAGE);
  expect(first.more).toBe(true);
  const second = await d.history({}, HISTORY_PAGE);
  expect(second.entries).toHaveLength(2);
  expect(second.more).toBe(false);
  expect((await d.history({ by: "bille" })).entries).toHaveLength(1);
  expect((await d.history({ type: "food" })).entries[0].byName).toBe("Herzii");
});

test("historyFilter keeps only known types and people", () => {
  const users = parseUsers("marcel:Hirsch");
  expect(historyFilter({ type: "walk", by: "marcel" }, users)).toEqual({ type: "walk", by: "marcel" });
  expect(historyFilter({ type: "bark", by: "mallory" }, users)).toEqual({});
  expect(historyFilter({ type: ["walk"], by: 1 }, users)).toEqual({});
});
