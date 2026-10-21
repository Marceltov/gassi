import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { secret } from "./secret";

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
