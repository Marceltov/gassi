import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.beforeEach(async ({ page }) => signInAs(page, "marcel"));

const todayList = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /Was heute/ }).getByRole("listitem");

test("tap Gassi: the tile says gerade eben · Hirsch, and undo removes it again", async ({ page }) => {
  const tile = page.getByRole("button", { name: /^Gassi/ });
  const walks = todayList(page).filter({ hasText: /^\d\d:\d\dGassi/ });
  const before = { text: await tile.textContent(), walks: await walks.count() };

  await tile.click();
  await expect(tile).toContainText("gerade eben · Hirsch");
  await expect(page.getByRole("status")).toContainText("Gassi eingetragen");
  await expect(walks).toHaveCount(before.walks + 1);

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(walks).toHaveCount(before.walks);
  await expect(tile).toHaveText(before.text!);
});

test("log food with 200 g through the sheet", async ({ page }, info) => {
  const note = `Abendessen ${info.project.name}`;
  await page.getByRole("button", { name: "Details für Futter" }).click();
  const sheet = page.getByRole("dialog", { name: "Futter eintragen" });
  await sheet.getByLabel("Menge (g)").fill("200");
  await sheet.getByLabel("Notiz").fill(note);
  await sheet.getByRole("button", { name: "Eintragen" }).click();

  await expect(sheet).toBeHidden();
  await expect(todayList(page).filter({ hasText: note })).toContainText("Futter, 200 g von Hirsch");
  await expect(page.getByRole("button", { name: /^Futter/ })).toContainText("gerade eben · Hirsch");
});
