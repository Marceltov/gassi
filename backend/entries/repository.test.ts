import { describe, expect, test } from "vitest";
import { dayBounds } from "../../shared/time";
import { currentDog } from "../dogs";
import { freshDatabase } from "../db/testing";
import { openDatabase } from "../db/open";
import { type Entry, latestByType, type NewEntry } from "./model";
import { EntryRepository } from "./repository";

const { db, dataDir } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const repo = () => new EntryRepository(db(), () => NOW);
const entryAt = (at: string, more: Partial<NewEntry> = {}): NewEntry => ({ dogId: 1, type: "walk", at, durationMin: null, amountG: null, note: null, loggedBy: "marcel", ...more });

describe("the database", () => {
  test("starts with the configured dog", async () => {
    expect(await currentDog(db())).toEqual({ id: 1, name: "Toffee" });
  });

  test("reopening keeps the dog and adds no second one", async () => {
    await db().destroy();
    const again = await openDatabase(dataDir(), "Other");
    expect(await again.selectFrom("dog").selectAll().execute()).toHaveLength(1);
    await again.destroy();
  });
});

describe("EntryRepository", () => {
  test("creates an entry with its timestamps", async () => {
    const e = await repo().create(entryAt("2026-10-20T09:30:00.000Z", { durationMin: 30, note: "Park" }));
    expect(e).toEqual<Entry>({ id: 1, dogId: 1, type: "walk", at: "2026-10-20T09:30:00.000Z", durationMin: 30, amountG: null, note: "Park", loggedBy: "marcel", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
    expect(await repo().get(e.id)).toEqual(e);
  });

  test("lists newest first, filtered by type and person", async () => {
    const r = repo();
    await r.create(entryAt("2026-10-20T07:00:00.000Z"));
    await r.create(entryAt("2026-10-20T08:00:00.000Z", { type: "food", amountG: 200, loggedBy: "bille" }));
    await r.create(entryAt("2026-10-20T09:00:00.000Z", { loggedBy: "bille" }));
    const ats = (es: Entry[]) => es.map((e) => e.at.slice(11, 13));
    expect(ats(await r.list({ dogId: 1 }))).toEqual(["09", "08", "07"]);
    expect(ats(await r.list({ dogId: 1, type: "walk" }))).toEqual(["09", "07"]);
    expect(ats(await r.list({ dogId: 1, loggedBy: "bille" }))).toEqual(["09", "08"]);
    expect(ats(await r.list({ dogId: 1, limit: 2, offset: 1 }))).toEqual(["08", "07"]);
  });

  test("lists today in the time zone, across midnight UTC", async () => {
    const r = repo();
    await r.create(entryAt("2026-10-19T21:59:00.000Z")); // 23:59 the day before, in Berlin
    await r.create(entryAt("2026-10-19T22:00:00.000Z")); // 00:00 today, in Berlin
    await r.create(entryAt("2026-10-20T21:59:00.000Z")); // 23:59 today
    await r.create(entryAt("2026-10-20T22:00:00.000Z")); // 00:00 tomorrow
    const { start, end } = dayBounds(NOW.getTime(), "Europe/Berlin");
    const today = await r.list({ dogId: 1, since: new Date(start).toISOString(), until: new Date(end).toISOString() });
    expect(today.map((e) => e.at)).toEqual(["2026-10-20T21:59:00.000Z", "2026-10-19T22:00:00.000Z"]);
  });

  test("edits the fields and stamps updatedAt", async () => {
    const e = await repo().create(entryAt("2026-10-20T09:00:00.000Z", { durationMin: 20 }));
    const later = new Date("2026-10-20T11:00:00Z");
    const edited = await new EntryRepository(db(), () => later).update(e.id, { at: "2026-10-20T08:45:00.000Z", durationMin: 25, amountG: null, note: "kurz" });
    expect(edited).toMatchObject({ at: "2026-10-20T08:45:00.000Z", durationMin: 25, note: "kurz", createdAt: NOW.toISOString(), updatedAt: later.toISOString() });
    expect(await repo().update(999, { at: e.at, durationMin: null, amountG: null, note: null })).toBeUndefined();
  });

  test("deletes", async () => {
    const e = await repo().create(entryAt("2026-10-20T09:00:00.000Z"));
    expect(await repo().remove(e.id)).toBe(true);
    expect(await repo().remove(e.id)).toBe(false);
    expect(await repo().get(e.id)).toBeUndefined();
  });
});

test("latestByType picks the newest entry of each type", async () => {
  const r = repo();
  const early = await r.create(entryAt("2026-10-20T07:00:00.000Z"));
  const late = await r.create(entryAt("2026-10-20T09:00:00.000Z", { loggedBy: "bille" }));
  const food = await r.create(entryAt("2026-10-20T08:00:00.000Z", { type: "food" }));
  expect(latestByType([early, late, food])).toEqual({ walk: late, food });
});
