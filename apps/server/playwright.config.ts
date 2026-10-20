// End-to-end tests against the production build (`npm run test:e2e` builds first): the API as the apps use it, through
// the typed client, and the link landing page in a browser. One fresh server and database per run.
import { defineConfig, devices } from "@playwright/test";

export const BASE_URL = "http://localhost:3100";
export const SETUP_LINK_FILE = "test-results/setup-link.txt";
/** api.spec.ts sets the server up and leaves Hirsch's device token here for the specs after it. */
export const TOKEN_FILE = "test-results/hirsch-token.txt";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One server and one database for every spec: run them one after another.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", locale: "de-DE", timezoneId: "Europe/Berlin" },
  projects: [
    { name: "api", testMatch: /api\.spec\.ts|health\.spec\.ts/ },
    { name: "browser", testMatch: /links\.spec\.ts/, dependencies: ["api"], use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // A fresh database each run, and only PUBLIC_URL set: what a self-hoster starts with.
    command: `rm -rf test-results/data ${SETUP_LINK_FILE} ${TOKEN_FILE} && next start -p 3100`,
    url: `${BASE_URL}/health`,
    reuseExistingServer: false,
    // Empty means off: a developer's .env.local (read by next start too) must not switch OIDC or mail on here.
    env: { PUBLIC_URL: BASE_URL, DATA_DIR: "test-results/data", SETUP_LINK_FILE, TZ: "Europe/Berlin", LOG_LEVEL: "warn", OIDC_ISSUER: "", OIDC_CLIENT_ID: "", OIDC_CLIENT_SECRET: "", SMTP_URL: "", SECRET: "" },
  },
});
