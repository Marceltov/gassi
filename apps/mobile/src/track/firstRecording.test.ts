import { expect, test } from "vitest";
import { clearKept } from "../data/kept";
import { takeFirstRecording } from "./firstRecording";

test("the hints come once: on the first walk this phone records, until signed out", () => {
  expect(takeFirstRecording()).toBe(true);
  expect(takeFirstRecording()).toBe(false);
  clearKept();
  expect(takeFirstRecording()).toBe(true);
});
