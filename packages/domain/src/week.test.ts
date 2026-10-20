import { describe, expect, test } from "vitest";
import type { Entry } from "./entry";
import { mondayOf, weekView } from "./week";

const TZ = "Europe/Berlin";
let id = 0;
const e = (type: Entry["type"], at: string, more: Partial<Entry> = {}): Entry => ({
  id: ++id,
  dogId: 1,
  type,
  at,
  endedAt: null,
  durationMin: null,
  amountG: null,
  foodKind: null,
  unitG: null,
  clientKey: null,
  note: null,
  loggedBy: "marcel",
  createdAt: at,
  updatedAt: at,
  ...more,
});
const names = new Map([
  ["marcel", "Hirsch"],
  ["bille", "Herzii"],
]);
const NOW = Date.parse("2026-10-23T12:00:00Z");
const view = (entries: Entry[], more: Partial<Parameters<typeof weekView>[0]> = {}) => weekView({ entries, walkers: {}, trainings: {}, names, monday: "2026-10-19", timeZone: TZ, now: NOW, ...more });

describe("weekView", () => {
  test("has seven days from Monday", () => {
    expect(view([]).days.map((d) => d.date)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  test("walk across midnight splits into two strip bars", () => {
    // Tuesday 23:30 to Wednesday 00:20 in Berlin
    const w = view([e("walk", "2026-10-20T21:30:00.000Z", { endedAt: "2026-10-20T22:20:00.000Z" })]);
    expect(w.days[1]).toMatchObject({ bars: [{ type: "walk", startMin: 23 * 60 + 30, endMin: 24 * 60 }], walkMin: 30 });
    expect(w.days[2]).toMatchObject({ bars: [{ type: "walk", startMin: 0, endMin: 20 }], walkMin: 20 });
  });

  test("a walk from the week before is clipped to Monday", () => {
    const w = view([e("walk", "2026-10-18T21:40:00.000Z", { endedAt: "2026-10-18T22:10:00.000Z" })]);
    expect(w.days[0].bars).toEqual([{ type: "walk", startMin: 0, endMin: 10 }]);
    expect(w.walkMinByPerson).toEqual([{ username: "marcel", name: "Hirsch", min: 10 }]);
  });

  test("a running walk counts up to now", () => {
    const w = view([e("walk", "2026-10-23T11:30:00.000Z", { clientKey: "k" })]);
    expect(w.days[4].bars).toEqual([{ type: "walk", startMin: 13 * 60 + 30, endMin: 14 * 60 }]);
  });

  test("food, pee and poop are ticks at their minute", () => {
    const w = view([e("pee", "2026-10-19T06:15:00.000Z"), e("food", "2026-10-19T05:00:00.000Z"), e("note", "2026-10-19T07:00:00.000Z")]);
    expect(w.days[0].ticks).toEqual([
      { type: "food", min: 7 * 60 },
      { type: "pee", min: 8 * 60 + 15 },
    ]);
  });

  test("joint walk counts for both people", () => {
    const walk = e("walk", "2026-10-21T08:00:00.000Z", { endedAt: "2026-10-21T08:40:00.000Z" });
    const alone = e("walk", "2026-10-22T08:00:00.000Z", { endedAt: "2026-10-22T08:20:00.000Z", loggedBy: "bille" });
    const w = view([walk, alone], { walkers: { [walk.id]: ["marcel", "bille"] } });
    expect(w.walkMinByPerson).toEqual([
      { username: "bille", name: "Herzii", min: 60 },
      { username: "marcel", name: "Hirsch", min: 40 },
    ]);
    expect(w.days.reduce((s, d) => s + d.walkMin, 0)).toBe(60);
  });

  test("exercise counts, treats and training time per person", () => {
    const t1 = e("training", "2026-10-21T15:00:00.000Z", { endedAt: "2026-10-21T15:12:00.000Z", loggedBy: "bille" });
    const t2 = e("training", "2026-10-22T15:00:00.000Z", { endedAt: "2026-10-22T15:05:00.000Z" });
    const w = view([t1, t2], { trainings: { [t1.id]: { exercises: ["Sitz", "Rückruf"], treats: 6 }, [t2.id]: { exercises: ["Rückruf"], treats: 2 } } });
    expect(w.exerciseCounts).toEqual([
      { name: "Rückruf", count: 2 },
      { name: "Sitz", count: 1 },
    ]);
    expect(w.treats).toBe(8);
    expect(w.trainingMinByPerson).toEqual([
      { username: "bille", name: "Herzii", min: 12 },
      { username: "marcel", name: "Hirsch", min: 5 },
    ]);
    expect(w.days[2]).toMatchObject({ trainingMin: 12, bars: [{ type: "training", startMin: 17 * 60, endMin: 17 * 60 + 12 }] });
  });
});

describe("mondayOf", () => {
  test("week starts Monday in Berlin", () => {
    expect(mondayOf(Date.parse("2026-10-20T10:00:00Z"), TZ)).toBe("2026-10-19");
    expect(mondayOf(Date.parse("2026-10-25T21:30:00Z"), TZ)).toBe("2026-10-19"); // Sunday 22:30, the night summer time ends
    expect(mondayOf(Date.parse("2026-10-25T23:30:00Z"), TZ)).toBe("2026-10-26"); // Monday 00:30
    expect(mondayOf(Date.parse("2026-10-18T22:30:00Z"), TZ)).toBe("2026-10-19"); // Monday 00:30 in Berlin, still Sunday in UTC
  });
});
