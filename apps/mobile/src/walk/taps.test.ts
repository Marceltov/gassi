import type { Command } from "@gassi/domain";
import { expect, test } from "vitest";
import { fromEnded, mergeTaps, summaryTaps, tapsOf } from "./taps";

const at = (min: number) => new Date(Date.UTC(2026, 9, 21, 10, min)).toISOString();
const pee = (min: number, dogId = 1) => ({ type: "pee" as const, at: at(min), dogId });

test("the server's taps and the unsent ones during the walk, oldest first, each once", () => {
  const known = summaryTaps({ pees: [{ at: at(5), dogId: 1 }], poops: [{ at: at(2), dogId: 1 }] });
  const unsent = [pee(5), pee(8, 2), pee(-1), pee(40)];
  expect(mergeTaps(known, unsent, at(0), at(30))).toEqual([{ type: "poop", at: at(2), dogId: 1 }, pee(5), pee(8, 2)]);
  expect(mergeTaps(known, unsent, at(0), null).map((t) => t.at)).toEqual([at(2), at(5), at(8), at(40)]);
});

test("only log commands are taps", () => {
  const commands: Command[] = [
    { id: "a", at: at(1), kind: "walk.pause", walkKey: "w" },
    { id: "b", at: at(2), kind: "log", type: "poop", dogId: 3 },
  ];
  expect(tapsOf(commands)).toEqual([{ type: "poop", at: at(2), dogId: 3 }]);
});

test("an ended walk the server doesn't know yet: its duration without the pause, and its taps with the unsent ones", () => {
  const ended = { key: "w", startedAt: at(0), endedAt: at(40), pauses: [{ startedAt: at(10), endedAt: at(16) }, { startedAt: at(38), endedAt: null }], walkers: [{ id: "p", name: "Hirsch" }], dogIds: [1], taps: [pee(5)] };
  expect(fromEnded(ended, [pee(20), pee(50)])).toMatchObject({ id: null, totalMin: 40, pauseMin: 8, walkers: [{ name: "Hirsch" }], taps: [pee(5), pee(20)] });
});
