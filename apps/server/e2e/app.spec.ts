// The Expo web app (apps/mobile, exported into public/) is what every path the server doesn't know answers; the API,
// the link pages and /health still win.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

test("/ and a deep link like /verlauf open the web app", async ({ page }) => {
  for (const [path, tab] of [["/", "Start"], ["/verlauf", "Verlauf"]]) {
    const res = await page.goto(path);
    expect(res!.status()).toBe(200);
    await expect(page).toHaveTitle("Gassi");
    for (const name of ["Start", "Verlauf", "Woche", "Mehr"]) await expect(page.getByRole("tab", { name })).toBeVisible();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  }
});

test("the app's fallback doesn't swallow the API, /health or the link pages", async ({ page, request }) => {
  const me = await request.get("/api/me");
  expect(me.status()).toBe(401);
  expect(await me.json()).toEqual({ error: "Bitte anmelden." });
  expect(await (await request.get("/api/nothing-here")).json()).toEqual({ error: "Gibt es nicht." });
  expect(await (await request.get("/health")).json()).toEqual({ status: "ok" });

  // the api project (a dependency of this one) set the server up and left Hirsch's token
  const invite = await createClient({ baseUrl: BASE_URL, token: readFileSync(TOKEN_FILE, "utf8").trim() }).createInvite({ kind: "device" });
  await page.goto(invite.url);
  await expect(page.getByRole("heading", { name: "Ein weiteres Gerät verbinden" })).toBeVisible();
});
