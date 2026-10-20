import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "./helpers";

const menuLink = (page: Page) => page.getByRole("link", { name: "Übungen und Leckerlis" });
const nav = (page: Page) => page.getByRole("navigation", { name: "Hauptmenü" });
const dock = (page: Page) => page.getByRole("region", { name: "Laufende Runde" });

test("the menu closes on a tap outside and when you go somewhere else", async ({ page }) => {
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: "Menü" }).click();
  await expect(menuLink(page)).toBeVisible();
  await page.mouse.click(200, 150);
  await expect(menuLink(page)).toBeHidden();

  await page.getByRole("button", { name: "Menü" }).click();
  await nav(page).getByRole("link", { name: "Woche" }).click();
  await expect(page).toHaveURL(/\/woche$/);
  await expect(menuLink(page)).toBeHidden();
});

test("during a walk the leash bar is on every screen: back to the walk and Pipi in one tap", async ({ page }) => {
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: /^Gassi/ }).click();
  await expect(page.getByRole("button", { name: "Zuhause" })).toBeVisible();
  await expect(dock(page)).toHaveCount(0); // the walk screen is the walk itself

  await nav(page).getByRole("link", { name: "Woche" }).click();
  await expect(dock(page)).toBeVisible();
  await dock(page).getByRole("button", { name: "Pipi eintragen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pipi eingetragen" })).toBeVisible();
  await dock(page).getByRole("link", { name: /Zur Runde/ }).click();
  await expect(page).toHaveURL(/\/runde$/);

  await page.getByRole("button", { name: "Zuhause" }).click();
  await page.getByRole("region", { name: "Runde beendet" }).getByRole("link", { name: "Fertig" }).click();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
  await expect(dock(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).not.toHaveURL(/fertig=/);
});

test("sub-pages show where you are and lead back", async ({ page }) => {
  await signInAs(page, "marcel");
  await nav(page).getByRole("link", { name: "Woche" }).click();
  const weight = page.getByRole("link", { name: "Gewicht" });
  await expect(weight).toBeInViewport();
  await weight.click();
  await expect(page).toHaveURL(/\/gewicht$/);
  await expect(nav(page).getByRole("link", { name: "Woche" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/\/woche$/);

  await nav(page).getByRole("link", { name: "Heute" }).click();
  await page.getByRole("button", { name: /^Futter/ }).click();
  await page.getByRole("dialog", { name: "Futter" }).getByRole("link", { name: "Vorrat" }).click();
  await expect(page.getByRole("heading", { name: "Vorrat" })).toBeVisible();
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
});

test("Training fertig stays in reach however many treats there are", async ({ page }, info) => {
  await signInAs(page, "bille");
  await page.goto("/einstellungen");
  const treats = page.getByRole("region", { name: "Leckerlis" });
  const names = [1, 2, 3, 4, 5].map((n) => `Reichweite ${n} ${info.project.name}`);
  for (const name of names) {
    await treats.getByLabel("Neues Leckerli").fill(name);
    await treats.getByLabel("Gramm pro Stück").fill("1");
    await treats.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(treats.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await page.goto("/training");
  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page.getByRole("button", { name: "Training fertig" })).toBeInViewport();
  await page.getByRole("button", { name: "Training fertig" }).click();
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();

  await page.goto("/einstellungen");
  for (const name of names) await treats.getByRole("button", { name: `${name} entfernen` }).click();
  await expect(treats.getByRole("listitem").filter({ hasText: "Reichweite" })).toHaveCount(0);
});
