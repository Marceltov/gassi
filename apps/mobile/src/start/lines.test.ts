import { expect, test } from "vitest";
import { lastFeeding, lastTraining, lastWalk } from "./lines";

const NOW = Date.parse("2026-10-20T12:00:00.000Z");
const at = "2026-10-20T08:30:00.000Z";

test("the last walk: how long ago it ended and who went; none yet says so", () => {
  expect(lastWalk({ at, endedAt: "2026-10-20T09:00:00.000Z", byName: "Herzii" }, NOW)).toBe("zuletzt vor 3 Std. · Herzii");
  expect(lastWalk(null, NOW)).toBe("noch keine Runde");
});

test("the last feeding: its grams and kind, else how long ago", () => {
  expect(lastFeeding({ at, endedAt: null, byName: "Hirsch", amountG: 80, foodKind: "wet" }, NOW)).toBe("zuletzt 80 g nass");
  expect(lastFeeding({ at, endedAt: null, byName: "Hirsch", amountG: 120, foodKind: "dry" }, NOW)).toBe("zuletzt 120 g trocken");
  expect(lastFeeding({ at, endedAt: null, byName: "Hirsch" }, NOW)).toBe("zuletzt vor 3 Std. 30 Min.");
  expect(lastFeeding(null, NOW)).toBe("noch nichts gefüttert");
});

test("the last training: its exercises with their success and the treats, else how long ago", () => {
  const training = { at, endedAt: "2026-10-20T08:40:00.000Z", byName: "Hirsch", exercises: [{ name: "Sitz", ok: 4, meh: 0, fail: 1 }], treats: 0 };
  expect(lastTraining(training, NOW)).toBe("Sitz ✓4 ~0 ✗1 zuletzt");
  expect(lastTraining({ ...training, treats: 3 }, NOW)).toBe("Sitz ✓4 ~0 ✗1 · 3 Leckerli zuletzt");
  expect(lastTraining({ ...training, exercises: [], treats: null }, NOW)).toBe("zuletzt vor 3 Std. 20 Min.");
  expect(lastTraining(null, NOW)).toBe("noch kein Training");
});
