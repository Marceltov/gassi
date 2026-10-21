// Signing the web app in: with an invitation's code typed loosely, with a link's token (/join), and back to the
// sign-in once the device is removed. Each test makes its own invitation with Hirsch's token from api.spec.ts.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { expect, type Page, test } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

const asHirsch = () => createClient({ baseUrl: BASE_URL, token: readFileSync(TOKEN_FILE, "utf8").trim() });
const startShows = async (page: Page) => {
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByRole("tab", { name: "Start" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Gassi gehen/ })).toBeVisible();
};

test("a new person signs in with the invitation's code, typed in lower case with spaces, and their name", async ({ page }) => {
  const invite = await asHirsch().createInvite({ kind: "person" });

  await page.goto("/");
  await expect(page).toHaveURL(`${BASE_URL}/anmelden`);
  await page.getByLabel("Code").fill(` ${invite.code.toLowerCase().replace("-", " ")} `);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Willkommen! Wie heißt du?")).toBeVisible();
  await page.getByLabel("Dein Name").fill("Lotte");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await startShows(page);
  expect((await asHirsch().people()).people.map((p) => p.name)).toContain("Lotte");

  // a reload stays signed in
  await page.reload();
  await startShows(page);
});

test("a device link opened in the browser signs in at once; removing the device shows the sign-in again", async ({ page }) => {
  const invite = await asHirsch().createInvite({ kind: "device" });

  await page.goto(`/join?token=${invite.url.split("/l/")[1]}`);
  await startShows(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gassi.kept.snapshot"))).not.toBeNull(); // kept for an offline start
  const token = JSON.parse((await page.evaluate(() => localStorage.getItem("gassi.device")))!).token as string;
  const asThisPhone = createClient({ baseUrl: BASE_URL, token });
  expect((await asThisPhone.me()).device).toMatchObject({ kind: "web", name: "Android (Web)" });

  // signed out from another phone: the next call answers 401 and the app asks to sign in instead of a broken Start
  await asThisPhone.removeDevice({ id: (await asThisPhone.me()).device.id });
  await page.reload();
  await expect(page).toHaveURL(`${BASE_URL}/anmelden`);
  await expect(page.getByLabel("Code")).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("gassi.device"), localStorage.getItem("gassi.kept.snapshot")])).toEqual([null, null]);
});

test("a used code says so; a failed sign-in from the provider says it didn't work", async ({ page }) => {
  const invite = await asHirsch().createInvite({ kind: "device" });
  await asHirsch().revokeInvite({ id: invite.id });

  await page.goto("/anmelden");
  await page.getByLabel("Code").fill(invite.code);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("alert")).toHaveText("Dieser Link ist abgelaufen oder schon benutzt.");
  await expect(page.getByRole("button", { name: "Mit authentik anmelden" })).toHaveCount(0); // no OIDC on this server

  await page.goto("/join?error=signin");
  await expect(page.getByRole("alert")).toHaveText("Anmeldung hat nicht geklappt.");
  await page.getByRole("button", { name: "Zur Anmeldung" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/anmelden`);
});
