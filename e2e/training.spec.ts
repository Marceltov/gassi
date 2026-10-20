import { expect, type Page, test } from "@playwright/test";
import { signInAs } from "./helpers";

async function addCatalog(page: Page, exercise: string, treat: string) {
  await page.goto("/einstellungen");
  const exercises = page.getByRole("region", { name: "Übungen" });
  await exercises.getByLabel("Neue Übung").fill(exercise);
  await exercises.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(exercises.getByRole("listitem").filter({ hasText: exercise })).toBeVisible();
  const treats = page.getByRole("region", { name: "Leckerlis" });
  await treats.getByLabel("Neues Leckerli").fill(treat);
  await treats.getByLabel("Gramm pro Stück").fill("1");
  await treats.getByLabel("aus dem Trockenfutter").uncheck();
  await treats.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(treats.getByRole("listitem").filter({ hasText: treat })).toBeVisible();
}

test("training at home: exercises and treats, then back to Heute", async ({ page }, info) => {
  const exercise = `Rückruf ${info.project.name} T`;
  const treat = `Käse ${info.project.name}`;
  await signInAs(page, "bille");
  await addCatalog(page, exercise, treat);
  await page.goto("/");

  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page).toHaveURL(/\/training$/);
  const chip = page.getByRole("button", { name: exercise });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const plus = page.getByRole("button", { name: `+1 ${treat}` });
  await plus.click();
  await plus.click();
  await expect(page.getByRole("group", { name: treat })).toContainText("2");
  await page.getByRole("button", { name: "Training fertig" }).click();

  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Training starten" })).toBeVisible();
  await page.goto("/verlauf");
  await expect(page.getByRole("listitem").filter({ hasText: exercise }).first()).toContainText(`Training, 0 Min.: ${exercise}, 2 Leckerlis von Herzii`);
});

test("training on a walk returns to the walk", async ({ page }) => {
  await signInAs(page, "marcel");
  await page.getByRole("button", { name: /^Gassi/ }).click();
  await page.getByRole("button", { name: "Training", exact: true }).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.getByRole("button", { name: "Training fertig" }).click();
  await expect(page).toHaveURL(/\/runde$/);
  await page.getByRole("button", { name: "Zuhause" }).click();
  await expect(page.getByRole("region", { name: "Runde beendet" })).toContainText("Training");
});
