// The walk's route (#104): the phone that starts a walk records it while Gassi is open, the pill shows the distance
// and opens the route, another phone can take over. Positions come from Chromium's geolocation emulation.
import { createClient } from "@gassi/api-client";
import { expect, type BrowserContext, type Page, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { onlyOneDog, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const START = { latitude: 48.137, longitude: 11.575 };
const pill = (page: Page) => page.getByTestId("route-pill");

// moves the emulated position north, 1.5 m a step every 400 ms (a brisk walk: faster counts as a GPS jump), until
// stopped
function walkNorth(context: BrowserContext) {
  let north = 0;
  let going = true;
  const done = (async () => {
    while (going) {
      north += 1.5;
      await context.setGeolocation({ ...START, latitude: START.latitude + north / 111_195, accuracy: 5 });
      await new Promise((r) => setTimeout(r, 400));
    }
  })();
  return async () => {
    going = false;
    await done;
  };
}

async function startWalk(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Gassi gehen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
}

test.describe("with location allowed", () => {
  test.use({ permissions: ["geolocation"], geolocation: { ...START, accuracy: 5 } });

  test("records a walk and shows its route; the pill opens the route", async ({ page, context }) => {
    const restore = await onlyOneDog();
    const stop = walkNorth(context);
    try {
      await signIn(page);
      await startWalk(page);
      await expect(pill(page)).toContainText(/[1-9]\d* m/, { timeout: 30_000 });
      await pill(page).click();
      const sheet = page.getByTestId("route-sheet");
      await expect(sheet.getByTestId("track-map")).toBeVisible();
      for (const label of ["Strecke", "Dauer", "Tempo"]) await expect(sheet.getByText(label, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Zuhause" }).click();
      await expect(page.getByTestId("track-map")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/^\d+ m$/).first()).toBeVisible();
    } finally {
      await stop();
      await restore();
    }
  });

  test("another phone takes over", async ({ page, context, browser }) => {
    test.setTimeout(90_000); // the first phone hears of it with its next refresh, within 30 s
    const stop = walkNorth(context);
    const other = await browser.newContext({ permissions: ["geolocation"], geolocation: { ...START, accuracy: 5 } });
    const herPage = await other.newPage();
    try {
      await signIn(page, "Marcels Handy");
      await startWalk(page);
      await expect(pill(page)).toContainText(/\d+ m/, { timeout: 20_000 });

      const herToken = await signIn(herPage, "Herziis Handy");
      await herPage.goto("/");
      await herPage.getByRole("button", { name: /^Runde läuft/ }).click();
      await expect(pill(herPage)).toContainText("Strecke: Marcels Handy");
      await pill(herPage).click();
      await herPage.getByRole("button", { name: "Strecke hier aufnehmen" }).click();
      await herPage.keyboard.press("Escape");
      await expect(pill(herPage)).toContainText(/\d+ m|kein GPS-Signal/);
      const asHer = createClient({ baseUrl: BASE_URL, token: herToken });
      await expect.poll(async () => (await asHer.sessions()).walk?.recorder?.name).toBe("Herziis Handy");
      await expect(pill(page)).toContainText("Strecke: Herziis Handy", { timeout: 40_000 });
    } finally {
      await stop();
      await other.close();
    }
  });

  test("holds the screen while recording, with the switch on", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { held: string[] };
      w.held = [];
      Object.defineProperty(navigator, "wakeLock", { value: { request: async (type: string) => (w.held.push(type), { release: async () => undefined, addEventListener() {} }) } });
    });
    await signIn(page);
    await page.goto("/mehr");
    await page.getByRole("switch", { name: "Bildschirm auf der Runde anlassen" }).click();
    await startWalk(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { held: string[] }).held)).toContain("screen");
  });

  test("no fix says kein GPS-Signal", async ({ page }) => {
    await page.clock.install();
    await signIn(page);
    await startWalk(page);
    await page.clock.fastForward(40_000);
    await expect(pill(page)).toContainText("kein GPS-Signal");
  });

  test("only network fixes for a minute say ungefährer Standort (#127)", async ({ page, context }) => {
    await page.clock.install();
    await signIn(page);
    await startWalk(page);
    for (let step = 1; step <= 14; step++) {
      await context.setGeolocation({ ...START, latitude: START.latitude + (step * 7) / 111_195, accuracy: 250 });
      await page.clock.fastForward(5_000);
    }
    await expect(pill(page)).toContainText("ungefährer Standort");
    await pill(page).click();
    await expect(page.getByText("Nur ungefährer Standort – genauen Standort erlauben")).toBeVisible();
  });
});

test("no permission says GPS aus", async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    // Chromium without the permission asks; a headless run can't answer, so refuse as the browser would
    navigator.geolocation.watchPosition = (_ok, fail) => {
      setTimeout(() => fail?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 0);
      return 1;
    };
  });
  await signIn(page);
  await startWalk(page);
  await expect(pill(page)).toContainText("GPS aus");
  await pill(page).click();
  await expect(page.getByText("Standort für diese Seite in den Browser-Einstellungen erlauben.")).toBeVisible();
});
