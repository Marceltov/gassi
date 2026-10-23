import { expect, test } from "vitest";
import { byDay, oneRowPerCount } from "./history";

const TZ = "Europe/Berlin";

test("entries, newest first, fall into their days in the time zone: Heute, Gestern, then the date", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");
  const entries = [
    { id: 1, at: "2026-10-21T06:00:00Z" },
    { id: 2, at: "2026-10-20T22:30:00Z" }, // 00:30 on the 21st in Berlin
    { id: 3, at: "2026-10-20T12:00:00Z" },
    { id: 4, at: "2026-10-18T12:00:00Z" },
    { id: 5, at: "2026-10-18T08:00:00Z" },
  ];
  expect(byDay(entries, TZ, now).map((d) => [d.heading, d.entries.map((e) => e.id)])).toEqual([
    ["Heute", [1, 2]],
    ["Gestern", [3]],
    ["Sonntag, 18. Oktober", [4, 5]],
  ]);
  expect(byDay([], TZ, now)).toEqual([]);
});

test("a wet count (one entry per can size at one time) is one row: its first size stands for it", () => {
  const wet = (id: number, at: string) => ({ id, at, type: "stockcheck" as const, foodKind: "wet" as const });
  const entries = [{ id: 1, at: "2026-10-21T09:00:00Z", type: "food" as const, foodKind: "wet" as const }, wet(2, "2026-10-21T08:00:00Z"), wet(3, "2026-10-21T08:00:00Z"), wet(4, "2026-10-21T08:00:00Z"), wet(5, "2026-10-20T08:00:00Z"), { id: 6, at: "2026-10-20T08:00:00Z", type: "stockcheck" as const, foodKind: "dry" as const }];
  expect(oneRowPerCount(entries).map((e) => e.id)).toEqual([1, 2, 5, 6]);
});
