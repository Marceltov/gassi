// The food sheet: Futter geben → Eintragen, pre-filled from the newest feeding, also without reception.
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch } from "./sessions";
import { signIn } from "./signed-in";

// the server is shared: a feeding of this test is the newest one until it makes its own
const feed = (amountG: number, foodKind: "wet" | "dry") =>
  asHirsch().commands({ commands: [{ id: `food-${amountG}-${foodKind}-${Date.now()}`, at: new Date().toISOString(), kind: "food", amountG, foodKind }] });
const newest = async (client: ReturnType<typeof createClient>) => (await client.entries({ type: "food" })).entries[0];

test("the sheet opens with the newest feeding, a plus makes it 60 g dry, Eintragen shows it in the tile", async ({ page }) => {
  await feed(50, "dry");
  const token = await signIn(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet.getByRole("tab", { name: "Trocken" })).toHaveAttribute("aria-selected", "true");
  await expect(sheet.getByTestId("food-amount")).toHaveText("50 g");
  await sheet.getByRole("button", { name: "10 g mehr" }).click();
  await expect(sheet.getByTestId("food-amount")).toHaveText("60 g");
  await sheet.getByRole("button", { name: "Eintragen" }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("tile-Gefressen")).toContainText("gerade eben");
  await expect(page.getByTestId("tile-Gefressen")).toContainText("Hirsch");
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await newest(client)).amountG).toBe(60);
  expect(await newest(client)).toMatchObject({ foodKind: "dry", byName: "Hirsch" });
});

test("switching to wet takes that kind's last portion; the quick amounts and the stock line follow", async ({ page }) => {
  await asHirsch().restock({ foodKind: "wet", cans: 9, unitG: 400 });
  await feed(90, "wet");
  await feed(55, "dry");
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet.getByTestId("food-amount")).toHaveText("55 g"); // the server's answer is in (no default is 55)
  await sheet.getByRole("tab", { name: "Nass" }).click();
  await expect(sheet.getByTestId("food-amount")).toHaveText("90 g");
  await expect(sheet.getByRole("button", { name: "90 g", exact: true })).toBeVisible(); // a recent portion
  await expect(sheet.getByRole("button", { name: "1 Dose" })).toBeVisible(); // the can size is known
  await expect(sheet.getByTestId("food-stock")).toContainText("noch ");
  await sheet.getByRole("button", { name: "½ Dose" }).click();
  await expect(sheet.getByTestId("food-amount")).toHaveText("200 g");
  await sheet.getByRole("button", { name: "90 g", exact: true }).click();
  await expect(sheet.getByTestId("food-amount")).toHaveText("90 g");
  await sheet.getByRole("tab", { name: "Trocken" }).click();
  await expect(sheet.getByTestId("food-amount")).toHaveText("55 g");
});

test("without reception Eintragen is queued, the tile shows it at once, and it reaches the server later", async ({ page, context }) => {
  await feed(70, "wet");
  const token = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Futter geben" }).click(); // opened while online: the values are kept
  await expect(page.getByTestId("food-amount")).toHaveText("70 g"); // the server's answer is in
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("food-sheet")).toBeHidden();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet.getByTestId("food-amount")).toHaveText("70 g"); // from the kept values
  await sheet.getByRole("button", { name: "10 g weniger" }).click();
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("tile-Gefressen")).toContainText("gerade eben");
  await expect(page.getByTestId("tile-Gefressen")).toContainText("Hirsch");

  await context.setOffline(false);
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await newest(client)).amountG).toBe(60);
  expect(await newest(client)).toMatchObject({ foodKind: "wet" });
});
