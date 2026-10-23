// The food sheet: Futter geben → Eintragen, in grams per dog, pre-filled from the newest feeding, also without
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

  test("switching to wet takes that kind's last portion and its quick amounts", async ({ page }) => {
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
    await expect(sheet.getByRole("button", { name: /-g-Dose/ })).toHaveCount(0); // grams only, no can sizes
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

test("a feeding names no can: the sheet has no can choice and the feeding no can size", async ({ page }) => {
  const client = asHirsch();
  const { entries: bought } = await client.restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 4 }, { unitG: 800, cans: 2 }] });
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    const sheet = page.getByTestId("food-sheet");
    await sheet.getByRole("tab", { name: "Nass" }).click();
    await expect(sheet.getByTestId("food-amount")).toBeVisible();
    await expect(sheet.getByRole("button", { name: /-g-Dose/ })).toHaveCount(0);
    await expect(sheet.getByRole("tab", { name: /-g-Dose/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Eintragen" }).click();
    await expect(sheet).toBeHidden();
    const me = createClient({ baseUrl: BASE_URL, token });
    await expect.poll(async () => (await newest(me)).foodKind).toBe("wet");
    expect((await newest(me)).unitG).toBeNull();
    await me.deleteEntry({ id: (await newest(me)).id });
  } finally {
    for (const b of bought) await client.deleteEntry({ id: b.id }).catch(() => undefined);
  }
});

test("with two dogs the grams are per dog: Eintragen records what they get together, a dog switched off gets nothing", async ({ page }) => {
  const dogs = (await asHirsch().dogs()).dogs.filter((d) => !d.archived);
  test.skip(dogs.length !== 2, "needs exactly two dogs");
  await feed(300, "dry"); // both dogs: 150 g each
  const token = await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet.getByTestId("food-amount")).toHaveText("150 g");
  await expect(sheet.getByText("je Hund")).toBeVisible();
  await sheet.getByRole("button", { name: "10 g mehr" }).click();
  await sheet.getByRole("button", { name: dogs[1].name }).click(); // off
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toBeHidden();
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await newest(client)).amountG).toBe(160);
  expect((await newest(client)).dogIds).toEqual([dogs[0].id]);
});

test("+ Dose aufgemacht: two cans in one feeding, each its own entry; × takes one back; without reception they arrive later", async ({ page, context }) => {
  const client = asHirsch();
  const made: number[] = [];
  made.push(...(await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 200, cans: "2" }, { unitG: 400, cans: "3" }] })).entries.map((e) => e.id));
  try {
    const token = await signIn(page);
    const me = createClient({ baseUrl: BASE_URL, token });
    const openedOf = async () => (await me.entries({ type: "opened" })).entries.filter((e) => !made.includes(e.id));
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    const sheet = page.getByTestId("food-sheet");
    await sheet.getByRole("tab", { name: "Nass" }).click();
    const add = async (unitG: number) => {
      await sheet.getByRole("button", { name: "+ Dose aufgemacht" }).click();
      await expect(sheet.getByText("Welche Dose aufgemacht?")).toBeVisible();
      await sheet.getByRole("button", { name: `${unitG}-g-Dose` }).click();
    };
    await sheet.getByRole("button", { name: "+ Dose aufgemacht" }).click();
    await expect(sheet.getByRole("button", { name: "400-g-Dose" })).toContainText("noch 3");
    await sheet.getByRole("button", { name: "400-g-Dose" }).click();
    await add(200);
    await add(400);
    await expect(sheet.getByText("400-g-Dose aufgemacht")).toHaveCount(2);
    await sheet.getByRole("button", { name: "400-g-Dose aufgemacht entfernen" }).last().click();
    await expect(sheet.getByText("400-g-Dose aufgemacht")).toHaveCount(1);
    await expect(sheet.getByText("200-g-Dose aufgemacht")).toHaveCount(1);

    await context.setOffline(true);
    await sheet.getByRole("button", { name: "Eintragen" }).click();
    await expect(sheet).toBeHidden();
    await context.setOffline(false);
    await expect.poll(async () => (await openedOf()).map((e) => e.unitG).sort()).toEqual([200, 400]);
    made.push(...(await openedOf()).map((e) => e.id), (await newest(me)).id);
    expect((await me.stock()).wet.sizes.map((x) => [x.unitG, x.cans])).toEqual([[200, 1], [400, 2]]);

    // a double tap is one feeding and one can
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    await sheet.getByRole("tab", { name: "Nass" }).click();
    await add(400);
    await sheet.getByRole("button", { name: "Eintragen" }).dblclick();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await openedOf()).filter((e) => !made.includes(e.id)).length).toBe(1);
    await page.waitForTimeout(500);
    expect((await openedOf()).filter((e) => !made.includes(e.id))).toHaveLength(1);
    made.push(...(await openedOf()).map((e) => e.id), (await newest(me)).id);
  } finally {
    for (const id of made) await client.deleteEntry({ id }).catch(() => undefined);
  }
});
