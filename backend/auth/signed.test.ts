import { describe, expect, test } from "vitest";
import { safeEqual, signer } from "./signed";

const NOW = 1_800_000_000_000;
const s = signer("s".repeat(32));

describe("signer", () => {
  test("verifies what it signed", () => {
    expect(s.verify("session", s.sign("session", { username: "marcel" }, 60, NOW), NOW)).toMatchObject({ username: "marcel" });
  });

  test("expires after its time", () => {
    const token = s.sign("session", { username: "marcel" }, 60, NOW);
    expect(s.verify("session", token, NOW + 59_000)).not.toBeNull();
    expect(s.verify("session", token, NOW + 60_000)).toBeNull();
  });

  test("a value signed for another kind fails", () => {
    expect(s.verify("session", s.sign("oidc", { username: "marcel" }, 60, NOW), NOW)).toBeNull();
  });

  test("another key's signature fails", () => {
    expect(s.verify("session", signer("t".repeat(32)).sign("session", {}, 60, NOW), NOW)).toBeNull();
  });

  test("a changed payload fails", () => {
    const [, sig] = s.sign("session", { username: "marcel" }, 60, NOW).split(".");
    const forged = Buffer.from(JSON.stringify({ username: "bille", k: "session", exp: NOW / 1000 + 60 })).toString("base64url");
    expect(s.verify("session", `${forged}.${sig}`, NOW)).toBeNull();
  });

  test.each(["", "abc", "a.b.c", "a.", ".b"])("garbage %j fails", (token) => {
    expect(s.verify("session", token, NOW)).toBeNull();
  });
});

test("safeEqual", () => {
  expect(safeEqual("abc", "abc")).toBe(true);
  expect(safeEqual("abc", "abd")).toBe(false);
  expect(safeEqual("abc", "abcd")).toBe(false);
});
