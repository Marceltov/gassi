import { expect, test } from "vitest";
import { trainingLine } from "./lines";

test("a training on a walk reads like the training screen's line, after its duration", () => {
  const training = { min: 4, exercises: [{ name: "Sitz", ok: 4, fail: 1 }], treats: [{ name: "Käse", count: 2 }, { name: "Wurst", count: 1 }] };
  expect(trainingLine(training)).toBe("Training · 4 Min. · Sitz 4/5 · 3 Leckerli");
  expect(trainingLine({ ...training, exercises: [], treats: [] })).toBe("Training · 4 Min.");
});
