// The Start screen: four tiles on top, three big tiles at the bottom with when each was last, and a walk that starts
// with one tap. The server is
// shared, so each test starts with nothing running and ends what it started.
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { expectFits, PHONES } from "./fit";
import { asHirsch, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

test("Start shows the five rows and three big tiles; one tap on Gassi gehen starts the walk with a running clock", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/");

  for (const label of ["Draußen", "Gefressen", "Trainiert", "Pipi", "Poopoo"]) await expect(page.getByTestId(`tile-${label}`)).toBeVisible();
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

test("a feeding shows in the Gefressen tile with how long ago and who, and on the Futter tile what it was", async ({ page }) => {
  await asHirsch().commands({ commands: [{ id: `start-food-${Date.now()}`, at: new Date().toISOString(), kind: "food", amountG: 80, foodKind: "dry" }] });
  await signIn(page);
  await page.goto("/");
  const tile = page.getByTestId("tile-Gefressen");
  await expect(tile).toContainText("gerade eben");
  await expect(tile).toContainText("Hirsch");
  await expect(page.getByRole("button", { name: "Futter geben, zuletzt 80 g trocken" })).toBeVisible();
});

test("the Gassi tile says when the last walk was and who went; the Training tile how the last training went, and a running one's clock", async ({ page }) => {
  const client = asHirsch();
  const n = Date.now();
  const sitz = (await client.exercises()).exercises.find((e) => e.name === "Sitz") ?? (await client.addExercise({ name: "Sitz" }));
  const dog = (await client.dogs()).dogs.find((d) => !d.archived)!;
  const at = new Date().toISOString();
  const rep = (i: number, ok: boolean) => ({ id: `start-rep-${i}-${n}`, at, kind: "training.rep" as const, trainingKey: `st-${n}`, exerciseId: sitz.id, dogId: dog.id, ok, delta: 1 as const });
  await client.commands({
    commands: [
      { id: `start-w1-${n}`, at, kind: "walk.start", walkKey: `sw-${n}` },
      { id: `start-w2-${n}`, at, kind: "walk.stop", walkKey: `sw-${n}` },
      { id: `start-t1-${n}`, at, kind: "training.start", trainingKey: `st-${n}`, dogIds: [dog.id] },
      rep(1, true),
      rep(2, false),
      { id: `start-t2-${n}`, at, kind: "training.stop", trainingKey: `st-${n}` },
    ],
  });
  await signIn(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Gassi gehen, zuletzt gerade eben · \S/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Training starten, Sitz 1/2 zuletzt" })).toBeVisible();

  await page.getByRole("button", { name: "Training starten" }).dblclick(); // a double tap starts one training
  await expect(page).toHaveURL(`${BASE_URL}/training`);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Training läuft · \d+:\d\d$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Training läuft/ }).click();
  await expect(page).toHaveURL(`${BASE_URL}/training`);
});

test("on the go fits a small and a big phone with its big buttons: Start, a walk, a training; the Futter sheet's button is not big", async ({ page }) => {
  await signIn(page);
  const height = async (name: string) => (await page.getByRole("button", { name, exact: true }).boundingBox())!.height;
  await expectFits(page, "/", "Gassi gehen");

  for (const [width, h] of PHONES) {
    await page.setViewportSize({ width, height: h });
    await page.goto("/");
    await page.getByRole("button", { name: "Futter geben" }).click();
    const submit = page.getByTestId("food-sheet").getByRole("button", { name: "Eintragen" });
    await expect(submit).toBeInViewport({ ratio: 1 });
    expect((await submit.boundingBox())!.height).toBe(52);
  }

  await page.goto("/");
  await page.getByRole("button", { name: "Gassi gehen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expectFits(page, "/runde", "Zuhause");
  expect(await height("Zuhause")).toBe(72);
  expect(await height("Pipi")).toBeGreaterThan(72);
  await stopEverything();

  await page.goto("/");
  await page.getByRole("button", { name: /^Training starten/ }).click();
  await expect(page.getByRole("button", { name: "Fertig" })).toBeVisible();
  await expectFits(page, new URL(page.url()).pathname, "Fertig");
  expect(await height("Fertig")).toBe(72);
});

test("the day at a glance is one list: a row each for Draußen, Gefressen, Trainiert, Pipi, Poopoo, one height, the times in one column; a row opens Verlauf with its kind", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const labels = ["Draußen", "Gefressen", "Trainiert", "Pipi", "Poopoo"];
  const rows = await Promise.all(labels.map((l) => page.getByTestId(`tile-${l}`).boundingBox()));
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i]!.y).toBeGreaterThan(rows[i - 1]!.y); // one under the other, in this order
    expect(rows[i]!.height).toBe(rows[0]!.height);
  }
  const times = await Promise.all(labels.map((l) => page.getByTestId(`tile-${l}-since`).boundingBox()));
  for (const t of times) expect(Math.round(t!.x + t!.width)).toBe(Math.round(times[0]!.x + times[0]!.width)); // right-aligned
  await page.getByTestId("tile-Trainiert").click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf?type=training`);
  await expectFits(page, "/", "Gassi gehen");
});
