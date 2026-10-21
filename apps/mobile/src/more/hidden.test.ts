import { expect, test } from "vitest";
import { clearKept } from "../data/kept";
import { loadHidden, saveHidden } from "./hidden";

test("hidden can sizes are kept per person and forgotten at sign-out", () => {
  saveHidden("p-hirsch", [{ unitG: 800, at: "2026-10-20T10:00:00.000Z" }]);
  expect(loadHidden("p-hirsch")).toEqual([{ unitG: 800, at: "2026-10-20T10:00:00.000Z" }]);
  expect(loadHidden("p-herzii")).toEqual([]);
  clearKept();
  expect(loadHidden("p-hirsch")).toEqual([]);
});
