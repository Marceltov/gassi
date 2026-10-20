import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the manifest is served without signing in", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Gassi", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
});

test("the service worker registers", async ({ page }) => {
  await signInAs(page, "marcel");
  const script = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(script).toMatch(/\/sw\.js$/);
});

test("the offline page is served without signing in", async ({ request }) => {
  const res = await request.get("/offline.html");
  expect(await res.text()).toContain("Keine Verbindung");
});
