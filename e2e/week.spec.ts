import { expect, test } from "@playwright/test";
import { berlinDay, signInAs } from "./helpers";

test("the week shows today's walk as a bar, and a day opens its Verlauf", async ({ page }, info) => {
  const note = `Wochenrunde ${info.project.name}`;
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: "Details für Gassi" }).click();
  const sheet = page.getByRole("dialog", { name: "Gassi eintragen" });
  await sheet.getByLabel("Zeit").fill(`${berlinDay()}T00:05`);
  await sheet.getByLabel("Dauer (Min.)").fill("40");
  await sheet.getByLabel("Notiz").fill(note);
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("navigation", { name: "Hauptmenü" }).getByRole("link", { name: "Woche" }).click();
  await expect(page.getByRole("heading", { name: "Woche", exact: true })).toBeVisible();
  const today = page.getByRole("link", { name: new RegExp(`^${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" }).format(new Date())}`) });
  await expect(today.getByTestId("bar-walk").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Summen" })).toContainText("Hirsch");

  await today.click();
  await expect(page).toHaveURL(new RegExp(`/verlauf\\?day=${berlinDay()}`));
  await expect(page.getByRole("listitem").filter({ hasText: note })).toBeVisible();
  await page.getByRole("link", { name: /^Tag:/ }).click();
  await expect(page).toHaveURL(/\/verlauf$/);

  await page.goto("/woche");
  await page.getByRole("link", { name: "Vorherige Woche" }).click();
  await expect(page).toHaveURL(/\/woche\?w=\d{4}-\d{2}-\d{2}/);
  await page.getByRole("link", { name: "Nächste Woche" }).click();
  await expect(today).toBeVisible();
});

test("weight from the week page", async ({ page }) => {
  await signInAs(page, "bille");
  await page.goto("/woche");
  await page.getByRole("link", { name: "Gewicht" }).click();
  await page.getByLabel("Gewicht (kg)").fill("12,4");
  await page.getByRole("button", { name: "Eintragen" }).click();
  await expect(page.getByText(/^12,4 kg am /)).toBeVisible();
  await expect(page.getByRole("img", { name: /Gewichtsverlauf/ })).toBeVisible();
});
