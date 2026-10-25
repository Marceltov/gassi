import type { Command } from "@gassi/domain";
import { expect, test } from "vitest";
import { batchEvent, commandEvent, syncEvent, tapName } from "./usage";

const base = { id: "c1", at: "2026-10-25T12:00:00.000Z" };

test("commandEvent: its kind, and only what says what kind of tap it was", () => {
  expect(commandEvent({ ...base, kind: "log", type: "pee", dogId: 1 })).toEqual({ name: "log", data: { type: "pee" } });
  expect(commandEvent({ ...base, kind: "quick.command", dogId: 1, exerciseId: 2, ok: false })).toEqual({ name: "quick.command", data: { ok: false } });
  expect(commandEvent({ ...base, kind: "walk.start", walkKey: "w1", dogIds: [1, 2] })).toEqual({ name: "walk.start", data: {} });
});

test("commandEvent never carries a note, an encounter's details or a name", () => {
  const note: Command = { ...base, kind: "log.entry", type: "personEncounter", note: "Geheim: Frau Müller", details: { place: "park" } as never };
  const event = commandEvent(note);
  expect(event).toEqual({ name: "log.entry", data: { type: "personEncounter" } });
  expect(JSON.stringify(event)).not.toMatch(/Geheim|Müller|park/);
});

test("syncEvent and batchEvent", () => {
  expect(syncEvent("sessions", 412.6, true, 3)).toEqual({ name: "sessions", data: { ms: 413, ok: true, queued: 3 } });
  const at = (acc: number | null) => ({ t: "2026-10-25T14:00:00Z", lat: 49.4, lon: 11.1, ele: null, acc });
  const points = [at(8), at(250), at(30), at(null)];
  expect(batchEvent(points, { stored: true, recording: false })).toEqual({ name: "batch", data: { points: 4, precise: 2, ok: true, stored: true, recording: false } });
  expect(batchEvent(points, null)).toEqual({ name: "batch", data: { points: 4, precise: 2, ok: false } });
});

test("tapName: a button's own event name before what it says, so typed or household names stay out", () => {
  expect(tapName({ event: "klappt", a11y: "Sitz klappt", label: "klappt" })).toBe("klappt");
  expect(tapName({ a11y: "Gassi gehen", label: "Gassi" })).toBe("Gassi gehen");
  expect(tapName({ label: "Fertig" })).toBe("Fertig");
});
