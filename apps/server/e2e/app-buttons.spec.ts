// One rule for buttons off the go (#80): side by side, the side action left and the main action right, one height; the
// main action in the color of the thing (dark where it has none), side actions outlined, Löschen a small trash icon,
// "Ja, löschen" red. Start, the walk and the training keep theirs.
import { expect, type Locator, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch } from "./sessions";
import { signIn } from "./signed-in";

const made: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

const box = async (l: Locator) => (await l.boundingBox())!;
const css = (l: Locator, prop: string) => l.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
/** Two buttons in one row: the same top and height, the first left of the second. */
async function sideBySide(left: Locator, right: Locator) {
  const [a, b] = await Promise.all([box(left), box(right)]);
  expect(a.y).toBe(b.y);
  expect(a.height).toBe(b.height);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);
}

test("an entry's detail: a trash icon left of Speichern in the thing's color; asking first, Abbrechen left of a red Ja, löschen", async ({ page }) => {
  const food = await asHirsch().logEntry({ type: "food", foodKind: "wet", amountG: 90 });
  made.push(food.id);
  await signIn(page);
  await page.goto(`${BASE_URL}/verlauf/eintrag/${food.id}`);
  const trash = page.getByRole("button", { name: "Löschen", exact: true });
  const save = page.getByRole("button", { name: "Speichern" });
  await sideBySide(trash, save);
  const t = await box(trash);
  expect(t.width).toBe(t.height); // an icon, square
  await expect(trash.getByText("Löschen")).toHaveCount(0); // no words, only the icon
  expect(await css(save, "background-image")).toContain("linear-gradient"); // Futter's orange

  await trash.click();
  const sheet = page.getByTestId("delete-sheet");
  await sideBySide(sheet.getByRole("button", { name: "Abbrechen" }), sheet.getByRole("button", { name: "Ja, löschen" }));
  expect(await css(sheet.getByRole("button", { name: "Ja, löschen" }), "background-color")).toBe("rgb(180, 35, 24)");
  expect(await css(sheet.getByRole("button", { name: "Abbrechen" }), "background-color")).toBe("rgba(0, 0, 0, 0)"); // outlined
});

test("a page without a color of its own saves in dark: Gewicht's entry", async ({ page }) => {
  const dog = (await asHirsch().dogs()).dogs.find((d) => !d.archived)!;
  const weight = await asHirsch().logEntry({ type: "weight", amountG: 24_000, dogIds: [dog.id] });
  made.push(weight.id);
  await signIn(page);
  await page.goto(`${BASE_URL}/verlauf/eintrag/${weight.id}`);
  expect(await css(page.getByRole("button", { name: "Speichern" }), "background-color")).toBe("rgb(27, 31, 36)");
});
