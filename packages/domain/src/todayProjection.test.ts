import { expect, test } from "vitest";
import type { Command } from "./commands";
import { layerToday, type Tiles } from "./todayProjection";

const ME = { id: "marcel", name: "Hirsch" };
const entry = (at: string, byName = "Herzii") => ({ at, endedAt: null, byName });
const none: Tiles = { walk: null, food: null, pee: null, poop: null };
const food = (at: string): Command => ({ id: at, at, kind: "food", amountG: 80, foodKind: "wet" });
const log = (at: string, type: "pee" | "poop"): Command => ({ id: at + type, at, kind: "log", type, dogId: 1 });

test("without pending taps the server's answer is shown as it is", () => {
  const today = { ...none, food: entry("2026-10-20T09:00:00.000Z") };
  expect(layerToday(today, [], ME)).toEqual(today);
  expect(layerToday(null, [], ME)).toEqual(none);
});

test("a pending feeding or pee/poop shows at once, by me, and the newest wins", () => {
  const today = { ...none, food: entry("2026-10-20T09:00:00.000Z"), pee: entry("2026-10-20T10:00:00.000Z") };
  const shown = layerToday(today, [food("2026-10-20T11:00:00.000Z"), food("2026-10-20T12:00:00.000Z"), log("2026-10-20T09:30:00.000Z", "pee"), log("2026-10-20T11:30:00.000Z", "poop")], ME);
  expect(shown.food).toEqual(entry("2026-10-20T12:00:00.000Z", "Hirsch"));
  expect(shown.pee).toEqual(today.pee); // the server already has a newer one
  expect(shown.poop).toEqual(entry("2026-10-20T11:30:00.000Z", "Hirsch"));
});

test("other taps leave the tiles alone, and the server's answer wins on a tie", () => {
  const today = { ...none, food: entry("2026-10-20T09:00:00.000Z") };
  expect(layerToday(today, [{ id: "w", at: "2026-10-20T10:00:00.000Z", kind: "walk.start", walkKey: "w" }, food("2026-10-20T09:00:00.000Z")], ME)).toEqual(today);
});
