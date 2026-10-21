import { expect, test } from "vitest";
import { csvField, entriesCsv } from "./csv";
import type { EntryView } from "./diary";

const EXTRAS = { dogNames: new Map([[1, "Toffee"], [2, "Bruno"]]), distanceM: new Map([[1, 3240]]) };
const entry = (more: Partial<EntryView>): EntryView => ({ id: 1, dogIds: [1], type: "walk", at: "2026-10-20T12:05:00.000Z", endedAt: null, durationMin: null, amountG: null, foodKind: null, unitG: null, clientKey: null, walkers: [], pauseMin: null, exercises: [], treats: null, note: null, loggedBy: "marcel", byName: "Hirsch", createdAt: "", updatedAt: "", ...more });

test("starts with a BOM and the German header, separated by ;", () => {
  const csv = entriesCsv([], "Europe/Berlin", EXTRAS);
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.slice(1)).toBe("Datum;Uhrzeit;Art;Hunde;Ende;Dauer (Min.);Pause (Min.);Futterart;Menge (g);Übungen;Leckerlis;Strecke (km);Notiz;Von\r\n");
});

test("one line per entry, oldest first, times in the time zone", () => {
  const csv = entriesCsv(
    [
      entry({ id: 4, type: "restock", at: "2026-10-21T09:00:00.000Z", dogIds: [], foodKind: "dry", amountG: 10_000 }),
      entry({ id: 3, type: "training", at: "2026-10-21T08:00:00.000Z", endedAt: "2026-10-21T08:12:00.000Z", durationMin: 12, exercises: [{ name: "Rückruf", ok: 1, fail: 0 }, { name: "Sitz", ok: 2, fail: 0 }], treats: 6, byName: "Herzii" }),
      entry({ id: 2, type: "food", at: "2026-10-20T22:30:00.000Z", amountG: 200, foodKind: "wet", byName: "Herzii" }),
      entry({ endedAt: "2026-10-20T12:57:00.000Z", durationMin: 52, pauseMin: 8, walkers: ["Hirsch", "Herzii"], dogIds: [1, 2] }),
    ],
    "Europe/Berlin",
    EXTRAS,
  );
  expect(csv.slice(1).split("\r\n")).toEqual([
    "Datum;Uhrzeit;Art;Hunde;Ende;Dauer (Min.);Pause (Min.);Futterart;Menge (g);Übungen;Leckerlis;Strecke (km);Notiz;Von",
    "2026-10-20;14:05;Gassi;Toffee, Bruno;2026-10-20 14:57;52;8;;;;;3,2;;Hirsch + Herzii",
    "2026-10-21;00:30;Futter;Toffee;;;;Nassfutter;200;;;;;Herzii",
    "2026-10-21;10:00;Training;Toffee;2026-10-21 10:12;12;;;;Rückruf, Sitz;6;;;Herzii",
    "2026-10-21;11:00;Einkauf;;;;;Trockenfutter;10000;;;;;Hirsch",
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
