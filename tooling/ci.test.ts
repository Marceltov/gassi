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

test("the image job signs the app's update with the key as a BuildKit secret, never a build argument or a layer", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  expect(ci).toMatch(/secrets: \|\n\s+updates_key=\$\{\{ secrets\.UPDATES_SIGNING_KEY \}\}/);
  expect(ci).not.toMatch(/build-args:[^\n]*UPDATES/);
  expect(dockerfile).toMatch(/RUN --mount=type=secret,id=updates_key[^\n]*\n?[^\n]*UPDATES_SIGNING_KEY_FILE=\/run\/secrets\/updates_key/);
});
