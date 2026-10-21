import { expect, test } from "vitest";
import { clearKept } from "../data/kept";
import { loadHidden, saveHidden } from "./hidden";

test("hidden can sizes are kept per person and forgotten at sign-out", () => {
  saveHidden("p-hirsch", [{ unitG: 800, seenLastAt: "2026-10-20T10:00:00.000Z" }, { unitG: 400, seenLastAt: null }]);
  expect(loadHidden("p-hirsch")).toEqual([{ unitG: 800, seenLastAt: "2026-10-20T10:00:00.000Z" }, { unitG: 400, seenLastAt: null }]);
  expect(loadHidden("p-herzii")).toEqual([]);
  saveHidden("p-old", [{ unitG: 800, at: "2026-10-20T10:00:00.000Z" }] as never); // kept by the version before: not trusted
  expect(loadHidden("p-old")).toEqual([]);
  clearKept();
  expect(loadHidden("p-hirsch")).toEqual([]);
});
