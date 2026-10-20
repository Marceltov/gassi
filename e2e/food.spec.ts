import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("restock wet food, feed from the sheet, see what is left", async ({ page }) => {
  await signInAs(page, "marcel");

  // Futter → sheet → Vorrat: two taps from Heute
  await page.getByRole("button", { name: /^Futter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Futter" });
  await sheet.getByRole("link", { name: "Vorrat" }).click();
  await expect(page.getByRole("heading", { name: "Vorrat" })).toBeVisible();

  const bought = page.getByRole("region", { name: "Eingekauft" });
  await bought.getByRole("radio", { name: "Nassfutter" }).check();
  await bought.getByLabel("Dosen").fill("12");
  await bought.getByLabel("Gramm pro Dose").fill("400");
  await bought.getByRole("button", { name: "Eintragen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Einkauf eingetragen" })).toBeVisible();

  // make the count known whatever earlier runs left behind
  const correct = page.getByRole("region", { name: "Bestand korrigieren" });
  await correct.getByRole("radio", { name: "Nassfutter" }).check();
  await correct.getByLabel("Dosen jetzt").fill("12");
  await correct.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("region", { name: "Nassfutter" })).toContainText("noch 12 Dosen");

  await page.goto("/");
  await page.getByRole("button", { name: /^Futter/ }).click();
  await sheet.getByRole("radio", { name: "Nassfutter" }).check();
  await sheet.getByLabel("Menge (g)").fill("200");
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("region", { name: /Was heute/ }).getByRole("listitem").first()).toContainText("Futter, Nassfutter, 200 g");

  await page.getByRole("button", { name: /^Futter/ }).click();
  await expect(sheet.getByRole("button", { name: "Nassfutter 200 g" })).toBeVisible();
  await sheet.getByRole("link", { name: "Vorrat" }).click();
  await expect(page.getByRole("region", { name: "Nassfutter" })).toContainText("noch 11½ Dosen");
  await expect(page.getByRole("region", { name: "Nassfutter" })).toContainText(/reicht noch etwa \d+ Tage/);
});

test("one tap on the usual portion logs it", async ({ page }) => {
  await signInAs(page, "bille");
  await page.getByRole("button", { name: /^Futter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Futter" });
  await sheet.getByRole("radio", { name: "Trockenfutter" }).check();
  await sheet.getByLabel("Menge (g)").fill("80");
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await page.getByRole("button", { name: /^Futter/ }).click();
  await sheet.getByRole("button", { name: "Trockenfutter 80 g" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Futter eingetragen");
  await expect(page.getByRole("region", { name: /Was heute/ }).getByRole("listitem").first()).toContainText("Futter, Trockenfutter, 80 g von Herzii");
});
