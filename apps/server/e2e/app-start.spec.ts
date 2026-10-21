// The Start screen: four tiles on top, three buttons at the bottom, and a walk that starts with one tap. The server is
// shared, so each test starts with nothing running and ends what it started.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";
import { signIn } from "./signed-in";

const asHirsch = () => createClient({ baseUrl: BASE_URL, token: readFileSync(TOKEN_FILE, "utf8").trim() });
async function stopEverything() {
  const client = asHirsch();
  const { walk, training } = await client.sessions();
  const at = new Date().toISOString();
  const commands = [
    ...(training ? [{ id: `stop-t-${Date.now()}`, at, kind: "training.stop" as const, trainingKey: training.key }] : []),
    ...(walk ? [{ id: `stop-w-${Date.now()}`, at, kind: "walk.stop" as const, walkKey: walk.key }] : []),
  ];
  if (commands.length) await client.commands({ commands });
}
test.beforeEach(stopEverything);
test.afterEach(stopEverything);

test("Start shows the four tiles and three buttons; one tap on Gassi gehen starts the walk with a running clock", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/");

  for (const label of ["Draußen", "Gefressen", "Pipi", "Poopoo"]) await expect(page.getByTestId(`tile-${label}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Futter geben" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Training starten" })).toBeVisible();
  await page.getByRole("button", { name: "Gassi gehen" }).dblclick(); // a double tap starts one walk

  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expect(page.getByText(/^\d+:\d\d$/)).toBeVisible();
  const clock = await page.getByText(/^\d+:\d\d$/).textContent();
  await expect.poll(() => page.getByText(/^\d+:\d\d$/).textContent()).not.toBe(clock); // it runs

  // the walk reached the server, and Start leads back into it
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await client.sessions()).walk !== null).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Runde läuft · \d+:\d\d/ })).toBeVisible();
  await page.getByRole("button", { name: /Runde läuft/ }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
});

test("a feeding shows in the Gefressen tile with how long ago and who", async ({ page }) => {
  await asHirsch().commands({ commands: [{ id: `start-food-${Date.now()}`, at: new Date().toISOString(), kind: "food", amountG: 80, foodKind: "dry" }] });
  await signIn(page);
  await page.goto("/");
  const tile = page.getByTestId("tile-Gefressen");
  await expect(tile).toContainText("gerade eben");
  await expect(tile).toContainText("Hirsch");
});
