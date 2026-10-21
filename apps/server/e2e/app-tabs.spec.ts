// The tab bar: on every screen of the signed-in app (also the screens opened from a tab, and under an open sheet),
// with the tab the screen belongs to highlighted, and clear of the iPhone's home indicator: Chromium is told the
// safe area an iPhone in the home-screen app has (34 px at the bottom), and the labels have to stay above it.
import { expect, type Page, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

const HOME_INDICATOR = 34;
const made: number[] = [];
test.beforeEach(stopEverything);
test.afterEach(async () => {
  await stopEverything();
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

const tabBar = (page: Page) => page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "Woche" }) });
const tab = (page: Page, name: "Start" | "Verlauf" | "Woche" | "Mehr") => tabBar(page).getByRole("tab", { name });

/** The safe area of an iPhone with a home indicator, as env(safe-area-inset-*) reports it in the page. */
async function homeIndicator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: HOME_INDICATOR, left: 0, right: 0 } });
}

/** The tab bar is on screen with every label, `selected` is highlighted, and the labels end above the home indicator. */
async function expectTabBar(page: Page, selected: "Start" | "Verlauf" | "Woche" | "Mehr") {
  await expect(tabBar(page)).toBeVisible();
  for (const name of ["Start", "Verlauf", "Woche", "Mehr"] as const) {
    await expect(tab(page, name)).toBeVisible();
    await expect(tab(page, name)).toHaveAttribute("aria-selected", String(name === selected));
  }
  const viewport = page.viewportSize()!;
  const label = (await tabBar(page).getByText(selected, { exact: true }).boundingBox())!;
  expect(label.y + label.height).toBeLessThanOrEqual(viewport.height - HOME_INDICATOR);
}

test("the tab bar keeps its labels above the home indicator: its bottom padding is the safe area", async ({ page }) => {
  await signIn(page);
  await page.goto("/woche");
  await homeIndicator(page);
  await expectTabBar(page, "Woche");
  const bar = tabBar(page).locator("xpath=..");
  const padding = await bar.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(padding).toBeGreaterThanOrEqual(HOME_INDICATOR);
  // the week's arrows stay above the tab bar, so away from the rounded corners
  const back = (await page.getByRole("button", { name: "Vorherige Woche" }).boundingBox())!;
  const top = (await bar.boundingBox())!.y;
  expect(back.y + back.height).toBeLessThanOrEqual(top);
});

test("Mehr's screens keep the tab bar with Mehr highlighted, also opened directly; the tab and the browser's back lead back to Mehr", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr/vorrat");
  await homeIndicator(page);
  await expect(page.getByRole("tab", { name: "Nass" })).toBeVisible();
  await expectTabBar(page, "Mehr");
  await expect(page.getByRole("button", { name: "Zurück" })).toHaveCount(0);
  await tab(page, "Mehr").click(); // opened directly: the tab still leads to Mehr
  await expect(page).toHaveURL(`${BASE_URL}/mehr`);
  await page.getByRole("button", { name: /^Hunde/ }).click();
  await expect(page).toHaveURL(`${BASE_URL}/mehr/hunde`);
  await expectTabBar(page, "Mehr");
  await page.goBack(); // the browser's back, too
  await expect(page).toHaveURL(`${BASE_URL}/mehr`);
  await page.getByRole("button", { name: /^Hunde/ }).click();
  await expect(page).toHaveURL(`${BASE_URL}/mehr/hunde`);
  await tab(page, "Mehr").click(); // the tab of the screen shown goes back to its first screen
  await expect(page).toHaveURL(`${BASE_URL}/mehr`);
});

test("a running walk and its training keep the tab bar with Start highlighted, also after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await homeIndicator(page);
  await page.getByRole("button", { name: "Gassi gehen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expect(page.getByTestId("walk-clock")).toBeVisible();
  await expectTabBar(page, "Start");
  await page.reload();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expect(page.getByTestId("walk-clock")).toBeVisible();
  await expectTabBar(page, "Start");

  // another tab and back: the walk is still where it was
  await tab(page, "Verlauf").click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await tab(page, "Start").click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await page.getByRole("button", { name: "Training" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/training`);
  await expectTabBar(page, "Start");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);

  // the summary after Zuhause stays on Start, and Fertig goes back to Start
  await page.getByRole("button", { name: "Zuhause" }).click();
  await expect(page).toHaveURL(/\/runde\/[^/]+$/);
  await expectTabBar(page, "Start");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByRole("button", { name: "Gassi gehen" })).toBeVisible();
});

test("an entry keeps the tab bar: opened directly on Verlauf, opened from Gewicht on Mehr", async ({ page }) => {
  const client = asHirsch();
  const dog = (await client.dogs()).dogs.find((d) => !d.archived)!;
  const key = `tabs-pee-${Date.now()}`;
  await client.commands({ commands: [{ id: key, at: new Date(Date.now() - 3 * 3_600_000).toISOString(), kind: "log", type: "pee", dogId: dog.id }] });
  const pee = (await client.entries({ type: "pee" })).entries[0];
  made.push(pee.id);
  const weight = await client.logWeight({ kg: 11.8, dogIds: [dog.id] });
  made.push(weight.id);

  await signIn(page);
  await page.goto(`/eintrag/${pee.id}`);
  await homeIndicator(page);
  await expect(page.getByRole("button", { name: "Löschen", exact: true })).toBeVisible();
  await expectTabBar(page, "Verlauf");
  await tab(page, "Verlauf").click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`); // a clean URL: the deep link's id stays with the entry

  await page.goto("/mehr/gewicht");
  await page.getByTestId("weight-list").getByRole("button", { name: /11,8 kg/ }).first().click();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${weight.id}`);
  await expectTabBar(page, "Mehr");
  await page.goBack(); // the browser's back goes to where it was opened; the tab to Mehr
  await expect(page).toHaveURL(`${BASE_URL}/mehr/gewicht`);
  await page.getByTestId("weight-list").getByRole("button", { name: /11,8 kg/ }).first().click();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${weight.id}`);
  await tab(page, "Mehr").click();
  await expect(page).toHaveURL(`${BASE_URL}/mehr`);
});

test("the food sheet sits above the tab bar, which stays tappable; another tab closes the sheet", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await homeIndicator(page);
  await page.getByRole("button", { name: "Futter geben" }).click();
  const sheet = page.getByTestId("food-sheet");
  await expect(sheet).toBeVisible();
  await expectTabBar(page, "Start");
  const bar = (await tabBar(page).locator("xpath=..").boundingBox())!;
  const overlay = (await page.getByTestId("sheet-overlay").boundingBox())!;
  expect(overlay.y + overlay.height).toBeLessThanOrEqual(bar.y + 1);
  const panel = (await page.getByRole("dialog", { name: "Futter geben" }).boundingBox())!;
  expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y + 1);

  await tab(page, "Woche").click();
  await expect(page).toHaveURL(`${BASE_URL}/woche`);
  await expect(sheet).toBeHidden();
  await tab(page, "Start").click();
  await expect(page.getByRole("button", { name: "Futter geben" })).toBeVisible();
  await expect(sheet).toBeHidden();
});
