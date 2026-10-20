// End-to-end tests against the production build (`npm run test:e2e` builds first), on a desktop browser and two phones.
import { defineConfig, devices } from "@playwright/test";

export const BASE_URL = "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One server and one database for every spec: run them one after another so the tiles and lists are predictable.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", locale: "de-DE", timezoneId: "Europe/Berlin" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "next start -p 3100",
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    env: { DATA_DIR: "test-results/data", TZ: "Europe/Berlin", LOG_LEVEL: "warn" },
  },
});
