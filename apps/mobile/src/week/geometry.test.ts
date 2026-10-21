import { expect, test } from "vitest";
import { barSpan, DAY, TICK_PX, tickSpan } from "./geometry";

test("a bar keeps its minutes; a short one is widened to stay visible", () => {
  expect(barSpan(600, 660)).toEqual({ left: 600, width: 60 });
  expect(barSpan(600, 602)).toEqual({ left: 600, width: 6 });
});

test("a bar or tick at the end of the day stays inside it", () => {
  expect(barSpan(1430, 1440)).toEqual({ left: 1430, width: 10 });
  expect(barSpan(1438, 1440)).toEqual({ left: 1434, width: 6 });
});

test("a tick is a few pixels wide at its minute, shifted left by its share of them so 23:59 stays inside the day", () => {
  expect(tickSpan(0)).toEqual({ left: 0, width: TICK_PX, shift: 0 });
  expect(tickSpan(720)).toEqual({ left: 720, width: TICK_PX, shift: -TICK_PX / 2 });
  const late = tickSpan(1439);
  // its right edge, on a strip of any width w: (1439 / 1440) · w − shift … stays at or before w
  expect(late.left / DAY + late.shift / 300 + TICK_PX / 300).toBeLessThanOrEqual(1);
  expect(TICK_PX).toBe(3);
});
