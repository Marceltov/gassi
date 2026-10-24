import { expect, test } from "vitest";
import { countLine, trainingLine, walkItems } from "./lines";

const training = { id: 9, startedAt: "2026-10-21T18:10:00.000Z", min: 4, exercises: [{ name: "Sitz", ok: 4, meh: 0, fail: 1 }], treats: [{ name: "Käse", count: 2 }, { name: "Wurst", count: 1 }] };

test("a training on a walk reads like the training screen's line, after its duration", () => {
  expect(trainingLine(training)).toBe("Training · 4 Min. · Sitz ✓4 ~0 ✗1 · 3 Leckerli");
  expect(trainingLine({ ...training, exercises: [], treats: [] })).toBe("Training · 4 Min.");
});

test("the walk's taps and trainings come in one list by time", () => {
  const pee = { type: "pee" as const, at: "2026-10-21T18:05:00.000Z", dogId: 1 };
  const poop = { type: "poop" as const, at: "2026-10-21T18:20:00.000Z", dogId: 1 };
  expect(walkItems([pee, poop], [training]).map((i) => i.at)).toEqual([pee.at, training.startedAt, poop.at]);
});

test("the counts name only what the walk had", () => {
  const pee = { type: "pee" as const, at: "2026-10-21T18:05:00.000Z", dogId: 1 };
  const poop = { type: "poop" as const, at: "2026-10-21T18:20:00.000Z", dogId: 1 };
  expect(countLine([pee, pee, poop], [training])).toBe("2× Pipi · 1× Poopoo · 1 Training");
  expect(countLine([poop], [training, training])).toBe("1× Poopoo · 2 Trainings");
  expect(countLine([], [])).toBe("Noch nichts");
});
