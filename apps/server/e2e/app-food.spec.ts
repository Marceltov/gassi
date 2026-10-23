// The food sheet: Futter geben → "60 g eintragen", in grams per dog, pre-filled from the newest feeding, also without
// reception. Most tests feed one dog, where per dog is all of it.
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, onlyOneDog } from "./sessions";
import { signIn } from "./signed-in";

// the server is shared: a feeding of this test is the newest one until it makes its own
const feed = (amountG: number, foodKind: "wet" | "dry", unitG?: number) =>
  asHirsch().commands({ commands: [{ id: `food-${amountG}-${foodKind}-${Date.now()}`, at: new Date().toISOString(), kind: "food", amountG, foodKind, ...(unitG ? { unitG } : {}) }] });
const newest = async (client: ReturnType<typeof createClient>) => (await client.entries({ type: "food" })).entries[0];

test.describe("one dog", () => {
  let restore: () => Promise<void>;
  test.beforeEach(async () => {
    restore = await onlyOneDog();
  });
  test.afterEach(() => restore());

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
    await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 9 }] });
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
    await expect(sheet.getByRole("button", { name: /Dose/ })).toHaveCount(0); // grams only, no cans
    await expect(sheet.getByTestId("food-stock")).toContainText("noch ");
    await sheet.getByRole("button", { name: "10 g mehr" }).click();
    await expect(sheet.getByTestId("food-amount")).toHaveText("100 g");
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
});

test("a wet feeding comes out of the last used can; the sheet asks which only while two sizes have cans left", async ({ page }) => {
  const client = asHirsch();
  const { entries: bought } = await client.restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 4 }, { unitG: 800, cans: 2 }] });
  try {
    await feed(400, "wet", 800); // the last used can is 800 g
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    const sheet = page.getByTestId("food-sheet");
    const dogs = (await client.dogs()).dogs.filter((d) => !d.archived).length;
    await expect(sheet.getByTestId("food-amount")).toHaveText(`${400 / dogs} g`); // the server's answer is in, per dog
    await expect(sheet.getByRole("tab", { name: "800-g-Dose" })).toHaveAttribute("aria-selected", "true");
    await sheet.getByRole("tab", { name: "400-g-Dose" }).click();
    await sheet.getByRole("button", { name: "eintragen" }).click();
    await expect(sheet).toBeHidden();
    const me = createClient({ baseUrl: BASE_URL, token });
    await expect.poll(async () => (await newest(me)).unitG).toBe(400);
    await me.deleteEntry({ id: (await newest(me)).id });

    // with only one size left the sheet doesn't ask, and the feeding comes out of it
    const counted = await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 400, cans: "0" }, { unitG: 800, cans: "2" }] });
    bought.push(...counted.entries);
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    await expect(sheet.getByTestId("food-stock")).toContainText("2 × 800 g");
    await expect(sheet.getByRole("tab", { name: /Dose/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: "eintragen" }).click();
    await expect.poll(async () => (await newest(me)).unitG).toBe(800);
    await me.deleteEntry({ id: (await newest(me)).id });
  } finally {
    for (const b of bought) await client.deleteEntry({ id: b.id }).catch(() => undefined);
  }
});

test("with two dogs the grams are per dog: the sheet says what they get together, a dog switched off gets nothing", async ({ page }) => {
  const dogs = (await asHirsch().dogs()).dogs.filter((d) => !d.archived);
  test.skip(dogs.length !== 2, "needs exactly two dogs");
  await feed(300, "dry"); // both dogs: 150 g each
  const token = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet.getByTestId("food-amount")).toHaveText("150 g");
  await expect(sheet.getByText("je Hund")).toBeVisible();
  await expect(sheet.getByTestId("food-total")).toHaveText("zusammen 300 g");
  await sheet.getByRole("button", { name: "10 g mehr" }).click();
  await expect(sheet.getByTestId("food-total")).toHaveText("zusammen 320 g");
  await sheet.getByRole("button", { name: dogs[1].name }).click(); // off
  await expect(sheet.getByTestId("food-total")).toHaveText("zusammen 160 g");
  await sheet.getByRole("button", { name: "160 g eintragen" }).click();
  await expect(sheet).toBeHidden();
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await newest(client)).amountG).toBe(160);
  expect((await newest(client)).dogIds).toEqual([dogs[0].id]);
});
