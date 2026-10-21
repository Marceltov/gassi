import { describe, expect, test } from "vitest";
import { isOver, joinsEndedSession, pausedWithin, resolveDogs, startedTrainingEndsAt } from "./sessionRules";

const at = (m: number) => `2026-10-20T09:${String(m).padStart(2, "0")}:00.000Z`;

describe("the rules for taps on walks and trainings", () => {
  test("a tap at or after the end of its walk or training is too late", () => {
    expect(isOver(null, at(50))).toBe(false);
    expect(isOver(at(30), at(29))).toBe(false);
    expect(isOver(at(30), at(30))).toBe(true);
  });

  test("a start that arrives late joins the walk that ran at its time, but never one whose end lies in the future", () => {
    const walk = { at: at(0), endedAt: at(30) };
    expect(joinsEndedSession(walk, at(10), at(40))).toBe(true);
    expect(joinsEndedSession(walk, at(30), at(40))).toBe(false);
    expect(joinsEndedSession(walk, at(10), at(20))).toBe(false); // the end was edited into the future
  });

  test("a training started on a walk that has ended since ends with it", () => {
    expect(startedTrainingEndsAt({ endedAt: at(30) })).toBe(at(30));
    expect(startedTrainingEndsAt({ endedAt: null })).toBeNull();
    expect(startedTrainingEndsAt(undefined)).toBeNull();
  });

  test("named dogs that are active, else every active dog", () => {
    expect(resolveDogs([2, 9], [1, 2])).toEqual([2]);
    expect(resolveDogs([9], [1, 2])).toEqual([1, 2]);
    expect(resolveDogs(undefined, [1])).toEqual([1]);
  });

  test("pauses count only between start and end", () => {
    expect(pausedWithin([{ startedAt: at(10), endedAt: at(15) }, { startedAt: at(25), endedAt: null }], at(0), at(30))).toBe(10 * 60_000);
    expect(pausedWithin([{ startedAt: at(30), endedAt: at(40) }], at(0), at(35))).toBe(5 * 60_000);
  });
});
