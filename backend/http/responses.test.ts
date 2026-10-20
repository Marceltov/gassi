import { expect, test } from "vitest";
import { safeNext } from "./responses";

test.each([
  ["/verlauf?type=walk", "/verlauf?type=walk"],
  ["/", "/"],
  ["//evil.example", "/"],
  ["/\\evil.example", "/"],
  ["/\t/evil.example", "/"],
  ["https://evil.example", "/"],
  ["verlauf", "/"],
  [undefined, "/"],
])("safeNext(%j) is %j", (next, want) => {
  expect(safeNext(next)).toBe(want);
});
