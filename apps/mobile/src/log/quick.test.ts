import { expect, test } from "vitest";
import { commandOf, quickLines, quickOf } from "./quick";

const exercises = [{ id: 1, name: "Sitz" }, { id: 2, name: "Platz" }];
const kinds = [{ id: 7, name: "Käse" }, { id: 8, name: "Huhn" }];

test("on a walk a tap gives the Leckerli on you, and asks only klappt or klappt nicht for the last exercise (#114)", () => {
  const usual = { exerciseId: 2, treatKindId: 8 };
  expect(quickOf("treat", usual, exercises, kinds, true)).toEqual({ kind: "quick.treat", treatKindId: 8 });
  expect(quickOf("command", usual, exercises, kinds, true)).toEqual({ kind: "ask", exerciseId: 2, treatKindId: 8 });
  expect(quickOf("command", { ...usual, commandTreat: false }, exercises, kinds, true)).toEqual({ kind: "ask", exerciseId: 2, treatKindId: undefined });
  expect(quickLines(usual, exercises, kinds)).toEqual({ command: "Platz", treat: "Huhn" });
  expect(quickLines({ ...usual, commandTreat: false }, exercises, kinds).command).toBe("Platz");
});

test("without a usual (or one since archived) a tap asks; off the walk only a single kind is given at once", () => {
  expect(quickOf("treat", {}, exercises, kinds, true)).toBeNull();
  expect(quickOf("command", { exerciseId: 9, treatKindId: 7 }, exercises, kinds, true)).toBeNull();
  expect(quickLines({ treatKindId: 9 }, exercises, kinds)).toEqual({ command: undefined, treat: undefined });
  expect(quickOf("treat", { treatKindId: 7 }, exercises, kinds, false)).toBeNull();
  expect(quickOf("command", { exerciseId: 1 }, exercises, kinds, false)).toBeNull();
  expect(quickOf("treat", {}, exercises, [kinds[0]], false)).toEqual({ kind: "quick.treat", treatKindId: 7 });
});

test("an answer logs the exercise; its Leckerli only when it worked", () => {
  const asked = { exerciseId: 2, treatKindId: 8 };
  expect(commandOf(asked, 5, true, "c1", "t")).toEqual({ id: "c1", at: "t", kind: "quick.command", dogId: 5, exerciseId: 2, ok: true, treatKindId: 8 });
  expect(commandOf(asked, 5, false, "c2", "t")).toEqual({ id: "c2", at: "t", kind: "quick.command", dogId: 5, exerciseId: 2, ok: false, treatKindId: undefined });
});
