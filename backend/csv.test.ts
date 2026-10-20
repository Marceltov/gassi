import { expect, test } from "vitest";
import { csvField, entriesCsv } from "./csv";
import type { EntryView } from "./diary";

const entry = (more: Partial<EntryView>): EntryView => ({ id: 1, dogId: 1, type: "walk", at: "2026-10-20T12:05:00.000Z", durationMin: null, amountG: null, note: null, loggedBy: "marcel", byName: "Hirsch", createdAt: "", updatedAt: "", ...more });

test("starts with a BOM and the German header, separated by ;", () => {
  const csv = entriesCsv([], "Europe/Berlin");
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.slice(1)).toBe("Datum;Uhrzeit;Art;Dauer (Min.);Menge (g);Notiz;Von\r\n");
});

test("one line per entry, oldest first, times in the time zone", () => {
  const csv = entriesCsv([entry({ id: 2, type: "food", at: "2026-10-20T22:30:00.000Z", amountG: 200, byName: "Herzii" }), entry({ durationMin: 30 })], "Europe/Berlin");
  expect(csv.slice(1).split("\r\n")).toEqual(["Datum;Uhrzeit;Art;Dauer (Min.);Menge (g);Notiz;Von", "2026-10-20;14:05;Gassi;30;;;Hirsch", "2026-10-21;00:30;Futter;;200;;Herzii", ""]);
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
