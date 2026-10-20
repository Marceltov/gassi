import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.beforeEach(async ({ page }) => signInAs(page, "marcel"));

const todayList = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /Was heute/ }).getByRole("listitem");

test("Gassi is the big card and shows when Toffee last peed; Pipi in between is one tap, and undo removes it", async ({ page }) => {
  const gassi = page.getByRole("button", { name: /^Gassi/ });
  const between = page.getByRole("group", { name: "Zwischendurch" });
  const pees = todayList(page).filter({ hasText: /^\d\d:\d\dPipi/ });
  const before = await pees.count();

  await between.getByRole("button", { name: "Pipi", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pipi eingetragen");
  await expect(gassi).toContainText("Pipi gerade eben");
  await expect(pees).toHaveCount(before + 1);

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(pees).toHaveCount(before);
});

test("a past walk with its duration through the Gassi sheet", async ({ page }, info) => {
  const note = `Nachgetragen ${info.project.name}`;
  await page.getByRole("button", { name: "Details für Gassi" }).click();
  const sheet = page.getByRole("dialog", { name: "Gassi eintragen" });
  await sheet.getByLabel("Dauer (Min.)").fill("35");
  await sheet.getByLabel("Notiz").fill(note);
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(todayList(page).filter({ hasText: note })).toContainText("Gassi, 35 Min.");
  await expect(page.getByRole("button", { name: /^Gassi/ })).not.toContainText("läuft");
});

test("log food with 200 g through the sheet", async ({ page }, info) => {
  const note = `Abendessen ${info.project.name}`;
  await page.getByRole("button", { name: "Details für Futter" }).click();
  const sheet = page.getByRole("dialog", { name: "Futter eintragen" });
  await sheet.getByLabel("Menge (g)").fill("200");
  await sheet.getByLabel("Notiz").fill(note);
  await sheet.getByRole("button", { name: "Eintragen" }).click();

  await expect(sheet).toBeHidden();
  await expect(todayList(page).filter({ hasText: note })).toContainText("Futter, Nassfutter, 200 g von Hirsch");
  await expect(page.getByRole("button", { name: /^Futter/ })).toContainText("gerade eben · Hirsch");
});
