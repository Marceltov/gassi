import { expect, test } from "vitest";
import { htmlPage, safeNext } from "./responses";

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

test("htmlPage escapes what it shows", async () => {
  const res = htmlPage(403, "<b>", "a & b", { href: "/login", label: "Zurück" });
  expect(res.status).toBe(403);
  expect(await res.text()).toContain("&#60;b&#62;");
});
