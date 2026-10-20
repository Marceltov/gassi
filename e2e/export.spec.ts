import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { logWithNote, openMenu, signInAs } from "./helpers";

test("the CSV download has the header and the entries", async ({ page }, info) => {
  const note = `Export ${info.project.name}`;
  await signInAs(page, "marcel");
  await logWithNote(page, "Poopoo", note);

  await openMenu(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Als CSV exportieren" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^gassi-\d{4}-\d\d-\d\d\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  expect(lines[0]).toBe("Datum;Uhrzeit;Art;Ende;Dauer (Min.);Pause (Min.);Futterart;Menge (g);Übungen;Leckerlis;Notiz;Von");
  expect(lines.find((l) => l.includes(note))).toMatch(new RegExp(`^\\d{4}-\\d\\d-\\d\\d;\\d\\d:\\d\\d;Poopoo;;;;;;;;${note};Hirsch$`));
});

test("signed out, the export sends you to the login page", async ({ page }) => {
  await page.goto("/export.csv");
  await expect(page).toHaveURL(/\/login\?next=%2Fexport\.csv$/);
});
