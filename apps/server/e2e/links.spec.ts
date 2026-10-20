// What a link opens on the household's server: "In App öffnen" with the app link, and a QR code.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

test("an invite link opens a page with the app link and a QR code; a used one says so", async ({ page }) => {
  // the api project (a dependency of this one) set the server up and left Hirsch's token
  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  const invite = await createClient({ baseUrl: BASE_URL, token }).createInvite({ kind: "device" });

  await page.goto(invite.url);
  await expect(page.getByRole("heading", { name: "Ein weiteres Gerät verbinden" })).toBeVisible();
  await expect(page.getByRole("link", { name: "In App öffnen" })).toHaveAttribute("href", invite.appLink);
  await expect(page.getByRole("img", { name: "QR-Code für die Gassi-App" }).locator("svg")).toBeVisible();

  await createClient({ baseUrl: BASE_URL }).redeem({ token: invite.url.split("/l/")[1], deviceKind: "phone", deviceName: "Neu" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dieser Link ist abgelaufen oder schon benutzt." })).toBeVisible();
  await expect(page.getByRole("link", { name: "In App öffnen" })).toHaveCount(0);
});
