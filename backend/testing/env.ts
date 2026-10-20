// For tests: a complete, valid environment, changed per test with withEnv(); config() reads it afresh each test.
import { afterEach, beforeEach, vi } from "vitest";
import { resetConfigForTests } from "../config";

export const TEST_ENV = {
  PUBLIC_URL: "https://gassi.example",
  SECRET: "test-secret-".padEnd(32, "x"),
  OIDC_ISSUER: "https://idp.example/application/o/gassi/",
  OIDC_CLIENT_ID: "gassi",
  OIDC_CLIENT_SECRET: "client-secret",
  TZ: "Europe/Berlin",
};

/** Every test in the file starts from TEST_ENV with `overrides` on top. */
export function withEnv(overrides: Record<string, string | undefined> = {}): void {
  beforeEach(() => setEnv(overrides));
  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigForTests();
  });
}

/** Changes the environment for the rest of the test. */
export function setEnv(vars: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries({ ...TEST_ENV, ...vars })) vi.stubEnv(k, v);
  resetConfigForTests();
}
