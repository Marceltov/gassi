import { expect, type Page, test } from "@playwright/test";
import { berlinDay, logWithNote, signInAs, switchUser } from "./helpers";

const entryWith = (page: Page, note: string) => page.getByRole("listitem").filter({ hasText: note });

test("entries by both people: filter by person, edit a time, delete", async ({ page }, info) => {
  const byBille = `Pipi von Bille ${info.project.name}`;
  const byMarcel = `Runde von Marcel ${info.project.name}`;
  await signInAs(page, "bille");
  await logWithNote(page, "Pipi", byBille);
  await switchUser(page, "marcel");
  await logWithNote(page, "Gassi", byMarcel);

  await page.getByRole("link", { name: "Verlauf" }).click();
  await expect(entryWith(page, byBille)).toContainText("Pipi von Herzii");
  await expect(entryWith(page, byMarcel)).toContainText("Gassi von Hirsch");

  // Filter by person
  await page.getByRole("navigation", { name: "Nach Person" }).getByRole("link", { name: "Herzii" }).click();
  await expect(page).toHaveURL(/by=bille/);
  await expect(entryWith(page, byBille)).toBeVisible();
  await expect(entryWith(page, byMarcel)).toHaveCount(0);
  await page.getByRole("navigation", { name: "Nach Person" }).getByRole("link", { name: "Alle" }).click();
  await expect(entryWith(page, byMarcel)).toBeVisible();

  // Edit a time: to 08:15 yesterday
  await entryWith(page, byBille).click();
  const edit = page.getByRole("dialog", { name: "Pipi bearbeiten" });
  await edit.getByLabel("Zeit").fill(`${berlinDay(1)}T08:15`);
  await edit.getByRole("button", { name: "Speichern" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole("region", { name: "Gestern" }).getByRole("listitem").filter({ hasText: byBille })).toContainText("08:15");

  // Delete, after confirming
  await entryWith(page, byMarcel).click();
  const del = page.getByRole("dialog", { name: "Gassi bearbeiten" });
  await del.getByRole("button", { name: "Löschen" }).click();
  await del.getByRole("button", { name: "Wirklich löschen" }).click();
  await expect(del).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Gelöscht");
  await expect(entryWith(page, byMarcel)).toHaveCount(0);
  await page.reload();
  await expect(entryWith(page, byMarcel)).toHaveCount(0);
});
