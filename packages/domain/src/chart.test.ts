import { expect, test } from "vitest";
import { weightPath } from "./chart";

const t = (d: number) => Date.parse("2026-10-01T00:00:00Z") + d * 86_400_000;

test("no points, no path", () => {
  expect(weightPath([], 100, 50)).toBe("");
});

test("one point is a dot in the middle", () => {
  expect(weightPath([{ at: t(0), kg: 12 }], 100, 50)).toBe("M50,25h0");
});

test("scales time across the width and weight across the height, with padding", () => {
  expect(weightPath([{ at: t(0), kg: 10 }, { at: t(10), kg: 12 }, { at: t(5), kg: 11 }], 100, 50)).toBe("M8,42L50,25L92,8");
});

test("the same weight all along is a flat line in the middle", () => {
  expect(weightPath([{ at: t(0), kg: 12 }, { at: t(3), kg: 12 }], 100, 50)).toBe("M8,25L92,25");
});
