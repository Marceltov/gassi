// CI's e2e job runs in Playwright's image (#88); its browsers fit only the Playwright version they were built for.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vitest";

const require = createRequire(new URL("../apps/server/package.json", import.meta.url));

test("the e2e job's Playwright image is the installed Playwright's version", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const { version } = require("@playwright/test/package.json") as { version: string };
  expect(ci.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/)?.[1]).toBe(version);
});
