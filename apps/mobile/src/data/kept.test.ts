import { expect, test } from "vitest";
import { clearKept, dropKept, loadKept, saveKept } from "./kept";

test("keeps what the server showed under its key, and forgets all of it at once, nothing else", () => {
  localStorage.setItem("gassi.device", "{}");
  saveKept("snapshot", { a: 1 });
  saveKept("food.p", [1, 2]);
  expect(loadKept("snapshot")).toEqual({ a: 1 });
  dropKept("snapshot");
  expect(loadKept("snapshot")).toBeNull();
  clearKept();
  expect(loadKept("food.p")).toBeNull();
  expect(localStorage.getItem("gassi.device")).toBe("{}");
});

test("something unreadable under a key counts as nothing kept", () => {
  localStorage.setItem("gassi.kept.snapshot", "{");
  expect(loadKept("snapshot")).toBeNull();
});
