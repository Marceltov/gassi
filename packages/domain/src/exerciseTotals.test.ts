import { expect, test } from "vitest";
import { exerciseTotals, trainingParts, trainingSummaryLine } from "./exerciseTotals";

test("sums the dogs of an exercise, keeps first-seen order and leaves out exercises without a rep", () => {
  expect(
    exerciseTotals([
      { name: "Sitz", ok: 2, fail: 1 },
      { name: "Bleib", ok: 0, fail: 0 },
      { name: "Sitz", ok: 1, fail: 0 },
      { name: "Rückruf", ok: 0, fail: 2 },
    ]),
  ).toEqual([
    { name: "Sitz", ok: 3, fail: 1 },
    { name: "Rückruf", ok: 0, fail: 2 },
  ]);
});

test("the running training's line reads exercises as successes/repetitions, summed over dogs, then the treats", () => {
  const rows = [
    { name: "Sitz", ok: 3, fail: 1 },
    { name: "Platz", ok: 2, fail: 2 },
    { name: "Sitz", ok: 1, fail: 0 },
    { name: "Bleib", ok: 0, fail: 0 },
  ];
  expect(trainingSummaryLine(rows, 5)).toBe("Sitz 4/5 · Platz 2/4 · 5 Leckerli");
  expect(trainingSummaryLine(rows, 0)).toBe("Sitz 4/5 · Platz 2/4");
  expect(trainingSummaryLine([], 1)).toBe("1 Leckerli");
  expect(trainingSummaryLine([], 0)).toBe("Noch nichts");
});

test("a training's parts for any line: the exercises summed over dogs, then the treats, \"Leckerli\" for any number", () => {
  expect(trainingParts([{ name: "Sitz", ok: 1, fail: 0 }, { name: "Sitz", ok: 0, fail: 1 }], 3)).toEqual(["Sitz 1/2", "3 Leckerli"]);
  expect(trainingParts([], 0)).toEqual([]);
});
