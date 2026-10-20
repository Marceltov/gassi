import { expect, test } from "@playwright/test";
import { openMenu, signInAs } from "./helpers";

test("keep the household's exercises and treat kinds", async ({ page }, info) => {
  const p = info.project.name;
  await signInAs(page, "marcel");
  await openMenu(page);
  await page.getByRole("link", { name: "Übungen und Leckerlis" }).click();
  await expect(page.getByRole("heading", { name: "Übungen und Leckerlis" })).toBeVisible();

  const exercises = page.getByRole("region", { name: "Übungen" });
  await exercises.getByLabel("Neue Übung").fill(`Rückruf ${p}`);
  await exercises.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(exercises.getByRole("listitem").filter({ hasText: `Rückruf ${p}` })).toBeVisible();

  await exercises.getByRole("button", { name: `Rückruf ${p} umbenennen` }).click();
  await exercises.getByLabel(`Neuer Name für Rückruf ${p}`).fill(`Rückruf mit Pfiff ${p}`);
  await exercises.getByRole("button", { name: "Speichern" }).click();
  await expect(exercises.getByRole("listitem").filter({ hasText: `Rückruf mit Pfiff ${p}` })).toBeVisible();

  const treats = page.getByRole("region", { name: "Leckerlis" });
  await treats.getByLabel("Neues Leckerli").fill(`Trockenfutter-Stück ${p}`);
  await treats.getByLabel("Gramm pro Stück").fill("0,5");
  await treats.getByLabel("aus dem Trockenfutter").check();
  await treats.getByRole("button", { name: "Hinzufügen" }).click();
  const row = treats.getByRole("listitem").filter({ hasText: `Trockenfutter-Stück ${p}` });
  await expect(row).toContainText("0,5 g · aus dem Trockenfutter");

  await treats.getByRole("button", { name: `Trockenfutter-Stück ${p} entfernen` }).click();
  await expect(row).toHaveCount(0);
});
