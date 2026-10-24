import { expect, test } from "vitest";
import { storage } from "./storage";

test("storage falls back to memory when localStorage throws", () => {
  const blocked = () => {
    throw new Error("blocked");
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length() { return blocked(); } },
    configurable: true,
    writable: true,
  });
  storage.setItem("a", "1");
  expect(storage.getItem("a")).toBe("1");
  expect(storage.keys()).toContain("a");
  storage.removeItem("a");
  expect(storage.getItem("a")).toBeNull();
});

test("keys lists what localStorage holds", () => {
  localStorage.setItem("gassi.kept.x", "1");
  storage.setItem("other", "2");
  expect(storage.keys()).toEqual(expect.arrayContaining(["gassi.kept.x", "other"]));
  expect(localStorage.getItem("other")).toBe("2");
});
