import { expect, test } from "vitest";
import { commandSchema } from "./commands";

const at = "2026-10-20T09:00:00.000Z";

test("pee and poop name their one dog; walks and trainings may name dogs", () => {
  expect(commandSchema.safeParse({ id: "1", at, kind: "log", type: "pee" }).success).toBe(false);
  expect(commandSchema.parse({ id: "1", at, kind: "log", type: "pee", dogId: 2 })).toMatchObject({ dogId: 2 });
  expect(commandSchema.parse({ id: "2", at, kind: "walk.start", walkKey: "w", dogIds: [1, 2] })).toMatchObject({ dogIds: [1, 2] });
  expect(commandSchema.parse({ id: "3", at, kind: "walk.start", walkKey: "w" })).not.toHaveProperty("dogIds");
  expect(commandSchema.parse({ id: "4", at, kind: "training.start", trainingKey: "t", dogIds: [3] })).toMatchObject({ dogIds: [3] });
});
