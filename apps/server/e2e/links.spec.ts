// What a link opens on the household's server: "In App öffnen" with the app link, a QR code, the link's code (it signs
// in like the link) and the way into the web app.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

test("an invite link opens a page with the app link, a QR code, its code and the web app; a used one says so", async ({ page }) => {
  // the api project (a dependency of this one) set the server up and left Hirsch's token
  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  const invite = await createClient({ baseUrl: BASE_URL, token }).createInvite({ kind: "device" });

  await page.goto(invite.url);
  await expect(page.getByRole("heading", { name: "Ein weiteres Gerät verbinden" })).toBeVisible();
  await expect(page.getByRole("link", { name: "In App öffnen" })).toHaveAttribute("href", invite.appLink);
  await expect(page.getByRole("img", { name: "QR-Code für die Gassi-App" }).locator("svg")).toBeVisible();
  await expect(page.getByText("In der Gassi-App vom Home-Bildschirm diesen Code eingeben")).toBeVisible();
  const linkToken = invite.url.split("/l/")[1];
  await expect(page.getByRole("link", { name: "Hier im Browser anmelden" })).toHaveAttribute("href", `${BASE_URL}/join?token=${linkToken}`);
  const code = (await page.getByLabel("Code", { exact: true }).textContent())!;
  expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

  // typed into the installed web app: the code signs in like the link, and uses it up
  await createClient({ baseUrl: BASE_URL }).redeem({ code: code.toLowerCase(), deviceKind: "phone", deviceName: "Neu" });
  await expect(createClient({ baseUrl: BASE_URL }).redeem({ token: linkToken, deviceKind: "phone", deviceName: "Neu" })).rejects.toThrow("Dieser Link ist abgelaufen oder schon benutzt.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dieser Link ist abgelaufen oder schon benutzt." })).toBeVisible();
  await expect(page.getByRole("link", { name: "In App öffnen" })).toHaveCount(0);
});
