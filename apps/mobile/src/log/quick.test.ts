import { expect, test } from "vitest";
import { quickLines, quickOf } from "./quick";

const exercises = [{ id: 1, name: "Sitz" }, { id: 2, name: "Platz" }];
const kinds = [{ id: 7, name: "Käse" }, { id: 8, name: "Huhn" }];

test("on a walk a tap logs the usual: the Leckerli on you, the last exercise as klappt with one of them", () => {
  const usual = { exerciseId: 2, treatKindId: 8 };
  expect(quickOf("treat", usual, exercises, kinds, true)).toEqual({ kind: "quick.treat", treatKindId: 8 });
  expect(quickOf("command", usual, exercises, kinds, true)).toEqual({ kind: "quick.command", exerciseId: 2, ok: true, treatKindId: 8 });
  expect(quickOf("command", { ...usual, commandTreat: false }, exercises, kinds, true)).toEqual({ kind: "quick.command", exerciseId: 2, ok: true, treatKindId: undefined });
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
