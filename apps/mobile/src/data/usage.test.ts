import type { Command } from "@gassi/domain";
import { expect, test } from "vitest";
import { batchEvent, commandEvent, syncEvent } from "./usage";

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
  expect(batchEvent(12, { stored: true, recording: false })).toEqual({ name: "batch", data: { points: 12, ok: true, stored: true, recording: false } });
  expect(batchEvent(12, null)).toEqual({ name: "batch", data: { points: 12, ok: false } });
});
