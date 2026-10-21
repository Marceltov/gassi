import { expect, test } from "vitest";
import { barSpan, tickSpan } from "./geometry";

test("a bar keeps its minutes; a short one is widened to stay visible", () => {
  expect(barSpan(600, 660)).toEqual({ left: 600, width: 60 });
  expect(barSpan(600, 602)).toEqual({ left: 600, width: 6 });
});

test("a bar or tick at the end of the day stays inside it", () => {
  expect(barSpan(1430, 1440)).toEqual({ left: 1430, width: 10 });
  expect(barSpan(1438, 1440)).toEqual({ left: 1434, width: 6 });
  expect(tickSpan(1439)).toEqual({ left: 1434, width: 6 });
  expect(tickSpan(0)).toEqual({ left: 0, width: 6 });
});
