import { expect, test } from "vitest";
import { picked } from "./picked";

test("picked: the day from the date dialog with the hour and minute from the time dialog", () => {
  const day = new Date(2026, 9, 24, 7, 30); // the day picked, still with the old time
  const time = new Date(2026, 9, 25, 9, 15, 42, 500); // the time picked (its day is the old one)
  const at = picked(day, time);
  expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds()]).toEqual([2026, 9, 24, 9, 15, 0, 0]);
});
