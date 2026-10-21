import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { linkCodeKey, secret } from "./secret";

const dir = () => mkdtempSync(join(tmpdir(), "gassi-secret-"));

test("is created once in the data folder and reused", () => {
  const d = dir();
  const first = secret(null, d);
  expect(first).toHaveLength(64);
  expect(secret(null, d)).toBe(first);
  expect(readFileSync(join(d, "secret"), "utf8").trim()).toBe(first);
  expect(statSync(join(d, "secret")).mode & 0o777).toBe(0o600);
});

test("SECRET from the environment wins", () => {
  expect(secret("s".repeat(32), dir())).toBe("s".repeat(32));
});

test("the link code key is derived once per secret and data folder, not per request", () => {
  const d = dir();
  const key = linkCodeKey(null, d);
  rmSync(join(d, "secret")); // not read again
  expect(linkCodeKey(null, d)).toBe(key);
  expect(linkCodeKey("s".repeat(32), d)).not.toBe(key);
  expect(linkCodeKey(null, dir())).not.toBe(key);
});
