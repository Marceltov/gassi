// The sync error banner: an answer the app can't take shows on top of the screen, with where it doesn't fit, and goes
// once the answers fit again. No reception shows no banner (that is `online`).
import { expect, test } from "@playwright/test";
import { signIn } from "./signed-in";

test("an answer that doesn't fit shows the banner until one fits again", async ({ page }) => {
  let broken = true;
  await page.route("**/api/sessions", async (route) => {
    if (!broken) return route.fallback();
    await route.fulfill({ json: { walk: { key: 1 }, training: null } });
  });
  await signIn(page);
  await page.goto("/");
  const banner = page.getByTestId("sync-error");
  await expect(banner).toContainText("Abgleich mit dem Server klappt nicht");
  await expect(banner).toContainText("Runde und Training: Die Antwort des Servers passt nicht zu dieser App-Version (walk.key:");
  await page.screenshot({ path: "test-results/sync-error.png" });

  broken = false;
  await page.goto("/mehr");
  await expect(page.getByTestId("more-Quellcode")).toBeVisible();
  await expect(banner).toHaveCount(0);
});
