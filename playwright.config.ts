// End-to-end tests against the production build (`npm run test:e2e` builds first), on a desktop browser and two phones.
import { defineConfig, devices } from "@playwright/test";
import { STUB_CLIENT_ID, STUB_ISSUER } from "./e2e/oidc-stub";

export const BASE_URL = "http://localhost:3100";
export const E2E_API_TOKEN = "e2e-api-token-".padEnd(32, "x");

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One server and one database for every spec: run them one after another so the tiles and lists are predictable.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", locale: "de-DE", timezoneId: "Europe/Berlin" },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // A fresh database each run.
    command: "rm -rf test-results/data && next start -p 3100",
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      PUBLIC_URL: BASE_URL,
      SECRET: "e2e-secret-".padEnd(32, "x"),
      OIDC_ISSUER: STUB_ISSUER,
      OIDC_CLIENT_ID: STUB_CLIENT_ID,
      OIDC_CLIENT_SECRET: "e2e-client-secret",
      USERS: "marcel:Hirsch,bille:Herzii",
      API_TOKEN: E2E_API_TOKEN,
      DATA_DIR: "test-results/data",
      TZ: "Europe/Berlin",
      LOG_LEVEL: "warn",
    },
  },
});
