import { expect, test } from "vitest";
import { byDay } from "./history";

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
