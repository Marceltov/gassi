import { expect, test } from "vitest";
import { gradedParts } from "./gradeParts";

test("a line's counts are picked out by their sign, a zero marked; other text stays whole", () => {
  expect(gradedParts("Sitz ✓3 ~0 ✗1 · 2 Leckerli")).toEqual([
    { text: "Sitz " },
    { text: "✓3", grade: "ok", zero: false },
    { text: " " },
    { text: "~0", grade: "meh", zero: true },
    { text: " " },
    { text: "✗1", grade: "fail", zero: false },
    { text: " · 2 Leckerli" },
  ]);
  expect(gradedParts("Kommando · Warte ~ · 1 Leckerli")[1]).toEqual({ text: "~", grade: "meh", zero: false });
  expect(gradedParts("ca.~5 Min")).toEqual([{ text: "ca.~5 Min" }]);
});
