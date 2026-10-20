import { expect, test } from "vitest";
import { csvField, entriesCsv } from "./csv";
import type { EntryView } from "./diary";

const entry = (more: Partial<EntryView>): EntryView => ({ id: 1, dogIds: [1], type: "walk", at: "2026-10-20T12:05:00.000Z", endedAt: null, durationMin: null, amountG: null, foodKind: null, unitG: null, clientKey: null, walkers: [], pauseMin: null, exercises: [], treats: null, note: null, loggedBy: "marcel", byName: "Hirsch", createdAt: "", updatedAt: "", ...more });

test("starts with a BOM and the German header, separated by ;", () => {
  const csv = entriesCsv([], "Europe/Berlin");
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.slice(1)).toBe("Datum;Uhrzeit;Art;Ende;Dauer (Min.);Pause (Min.);Futterart;Menge (g);Übungen;Leckerlis;Notiz;Von\r\n");
});

test("one line per entry, oldest first, times in the time zone", () => {
  const csv = entriesCsv(
    [
      entry({ id: 3, type: "training", at: "2026-10-21T08:00:00.000Z", endedAt: "2026-10-21T08:12:00.000Z", durationMin: 12, exercises: ["Rückruf", "Sitz"], treats: 6, byName: "Herzii" }),
      entry({ id: 2, type: "food", at: "2026-10-20T22:30:00.000Z", amountG: 200, foodKind: "wet", byName: "Herzii" }),
      entry({ endedAt: "2026-10-20T12:57:00.000Z", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"] }),
    ],
    "Europe/Berlin",
  );
  expect(csv.slice(1).split("\r\n")).toEqual([
    "Datum;Uhrzeit;Art;Ende;Dauer (Min.);Pause (Min.);Futterart;Menge (g);Übungen;Leckerlis;Notiz;Von",
    "2026-10-20;14:05;Gassi;2026-10-20 14:57;52;8;;;;;;Hirsch + Herzii",
    "2026-10-21;00:30;Futter;;;;Nassfutter;200;;;;Herzii",
    "2026-10-21;10:00;Training;2026-10-21 10:12;12;;;;Rückruf, Sitz;6;;Herzii",
    "",
  ]);
});

test.each([
  ["plain", "plain"],
  ["a;b", '"a;b"'],
  ['sagt "Sitz"', '"sagt ""Sitz"""'],
  ["zwei\nZeilen", '"zwei\nZeilen"'],
  [null, ""],
  [42, "42"],
])("csvField(%j) is %j", (value, want) => {
  expect(csvField(value)).toBe(want);
});
