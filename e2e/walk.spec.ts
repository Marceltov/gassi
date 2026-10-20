import { expect, type Page, test } from "@playwright/test";
import { signInAs, switchUser } from "./helpers";

const unsent = (page: Page) => page.getByText(/noch nicht gesendet/);
const summary = (page: Page) => page.getByRole("region", { name: "Runde beendet" });

test("a walk: start at the door, pee, pause, a second walker joins, home", async ({ page }) => {
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: /^Gassi/ }).click();
  await expect(page).toHaveURL(/\/runde$/);
  await expect(page.getByRole("button", { name: "Zuhause" })).toBeVisible();

  await page.getByRole("button", { name: "Pipi", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pipi eingetragen" })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(unsent(page)).toHaveCount(0);

  // Herzii on her own phone sees the walk and joins it
  await switchUser(page, "bille");
  await expect(page.getByRole("button", { name: /^Gassi/ })).toContainText("läuft seit");
  const banner = page.getByRole("link", { name: /Hirsch ist seit \d+ Min\. unterwegs/ });
  await banner.click();
  await expect(page).toHaveURL(/\/runde$/);
  await page.getByRole("button", { name: "Mitgehen" }).click();
  await expect(page.getByText("Hirsch + Herzii")).toBeVisible();
  await page.getByRole("button", { name: "Zuhause" }).click();

  await expect(summary(page)).toContainText("Hirsch + Herzii");
  await expect(summary(page)).toContainText("Pipi 1×");
  await expect(summary(page)).toContainText(/\d+ Min\., davon \d+ Min\. Pause/);
  await summary(page).getByRole("button", { name: "Notiz hinzufügen" }).click();
  await summary(page).getByLabel("Notiz").fill("Runde um den See");
  await summary(page).getByRole("button", { name: "Speichern" }).click();
  await expect(summary(page)).toContainText("Runde um den See");
  await summary(page).getByRole("link", { name: "Fertig" }).click();
  await expect(page.getByRole("button", { name: /^Gassi/ })).not.toContainText("läuft");
});

test("taps without reception wait on the phone and are sent later", async ({ page, context }) => {
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: /^Gassi/ }).click();
  await expect(page.getByRole("button", { name: "Zuhause" })).toBeVisible();
  await expect(unsent(page)).toHaveCount(0);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Poopoo", exact: true }).click();
  await expect(page.getByText("1 noch nicht gesendet")).toBeVisible();
  await context.setOffline(false);
  await expect(unsent(page)).toHaveCount(0, { timeout: 20_000 });

  await page.getByRole("button", { name: "Zuhause" }).click();
  await expect(summary(page)).toContainText("Poopoo 1×");
  await page.goto("/verlauf");
  await expect(page.getByRole("listitem").filter({ hasText: /Poopoo von Hirsch/ }).first()).toBeVisible();
});
