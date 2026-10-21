import { expect, test } from "vitest";
import { exerciseTotals } from "./exerciseTotals";

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
