import type { Output } from "@gassi/api-client";
import { expect, test } from "vitest";
import { bumpRep, bumpTreat, countEdits, editInput, formOf, historyQuery, pickDog, trainingInput } from "./form";

type Entry = Output<"entry">;
const entry = (more: Partial<Entry>): Entry => ({
  id: 7,
  dogIds: [1],
  type: "food",
  at: "2026-10-20T10:00:00.000Z",
  endedAt: null,
  durationMin: null,
  amountG: 80,
  foodKind: "wet",
  unitG: null,
  clientKey: null,
  note: null,
  loggedBy: "marcel",
  byName: "Hirsch",
  walkers: [],
  walkerIds: [],
  pauseMin: null,
  exercises: [],
  treats: null,
  reps: [],
  treatCounts: [],
  distanceM: null,
  route: null,
  during: null,
  count: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  ...more,
});

test("an edit sends every field as the form has it, the note trimmed or null; walkers only for a walk", () => {
  const food = entry({ unitG: null });
  const form = { ...formOf(food), amountG: 90, note: "  " };
  expect(editInput(food, form)).toEqual({ id: 7, at: food.at, endedAt: null, dogIds: [1], amountG: 90, foodKind: "wet", unitG: null, note: null });
  const walk = entry({ type: "walk", amountG: null, foodKind: null, endedAt: "2026-10-20T11:00:00.000Z", walkerIds: ["marcel"], dogIds: [1, 2] });
  expect(editInput(walk, { ...formOf(walk), note: " matschig ", walkerIds: ["marcel", "bille"] })).toMatchObject({ endedAt: walk.endedAt, note: "matschig", walkers: ["marcel", "bille"], dogIds: [1, 2] });
});

test("repetitions and treats count up and down, never below 0; a training edit keeps only its dogs' reps", () => {
  let reps = bumpRep([], 3, 1, "ok", 1);
  reps = bumpRep(reps, 3, 1, "ok", 1);
  reps = bumpRep(reps, 3, 1, "fail", -1);
  expect(reps).toEqual([{ exerciseId: 3, dogId: 1, ok: 2, fail: 0 }]);
  expect(bumpTreat(bumpTreat([], 5, -1), 5, 1)).toEqual([{ treatKindId: 5, count: 1 }]);
  const training = entry({ type: "training", dogIds: [1, 2] });
  const form = { ...formOf(training), dogIds: [2], reps: [...reps, { exerciseId: 3, dogId: 2, ok: 0, fail: 1 }], treats: [{ treatKindId: 5, count: 1 }] };
  expect(trainingInput(training, form)).toEqual({ id: 7, reps: [{ exerciseId: 3, dogId: 2, ok: 0, fail: 1 }], treats: [{ treatKindId: 5, count: 1 }] });
});

test("picking a dog: one for pee, at least one for a walk", () => {
  expect(pickDog("pee", [1], 2)).toEqual([2]);
  expect(pickDog("walk", [1], 2)).toEqual([1, 2]);
  expect(pickDog("walk", [1, 2], 1)).toEqual([2]);
  expect(pickDog("walk", [2], 2)).toEqual([2]);
});

test("the history query leaves out what isn't filtered", () => {
  expect(historyQuery({}, 0)).toEqual({});
  expect(historyQuery({ by: "bille", type: "walk", dog: 2 }, 50)).toEqual({ by: "bille", type: "walk", dog: "2", offset: 50 });
});

test("an opened can changed to another size sends that size, one can of it", () => {
  const e = entry({ type: "opened", dogIds: [], amountG: 400, unitG: 400 });
  expect(editInput(e, { ...formOf(e), unitG: 800 })).toMatchObject({ unitG: 800, amountG: 800 });
});

test("a wet count: this row sends its cans, the other rows changed go as edits of their own at the count's time", () => {
  const e = entry({ id: 7, type: "stockcheck", dogIds: [], amountG: 1200, unitG: 400, count: [{ id: 7, unitG: 400, amountG: 1200 }, { id: 8, unitG: 800, amountG: 800 }, { id: 9, unitG: 200, amountG: 400 }] });
  const f = formOf(e);
  expect(f.count).toEqual([{ id: 7, unitG: 400, cans: 3 }, { id: 8, unitG: 800, cans: 1 }, { id: 9, unitG: 200, cans: 2 }]);
  const changed = { ...f, at: "2026-10-20T11:00:00.000Z", count: [{ id: 7, unitG: 400, cans: 4 }, { id: 8, unitG: 800, cans: 0 }, { id: 9, unitG: 200, cans: 2 }] };
  expect(editInput(e, changed)).toMatchObject({ id: 7, amountG: 1600, unitG: 400 });
  expect(countEdits(e, changed)).toEqual([{ id: 8, at: "2026-10-20T11:00:00.000Z", endedAt: null, dogIds: [], amountG: 0, foodKind: "wet", unitG: 800, note: null }]);
});
