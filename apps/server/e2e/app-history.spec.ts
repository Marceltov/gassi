// Verlauf: what happened, newest first, grouped by day; an entry opens to be changed or deleted, a walk opens its
// summary; filters by person, type and dog. Each test makes its own entries and looks only at those (the server is
// shared), and deletes what it made.
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const made: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const firstDog = async () => (await asHirsch().dogs()).dogs.filter((d) => !d.archived)[0];

test("a feeding's grams are changed in its detail (not without reception), and the list shows the new amount", async ({ page, context }) => {
  const food = await asHirsch().logEntry({ type: "food", foodKind: "wet", amountG: 123 });
  made.push(food.id);
  await signIn(page);
  await page.goto("/verlauf");
  const row = page.getByTestId(`entry-${food.id}`);
  await expect(row).toContainText("123 g");
  await expect(row).toContainText("Hirsch");

  await row.click();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${food.id}`);
  await expect(page.getByTestId("edit-amount")).toHaveText("123 g");
  await page.getByRole("button", { name: "10 g mehr" }).click();
  await expect(page.getByTestId("edit-amount")).toHaveText("133 g");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Keine Verbindung – bitte später nochmal.")).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${food.id}`);
  await context.setOffline(false);

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(row).toContainText("133 g");
  expect((await asHirsch().entry({ id: food.id })).amountG).toBe(133);
});

test("a pee is deleted after asking, and is gone from the list", async ({ page }) => {
  const dog = await firstDog();
  const pee = await asHirsch().logEntry({ type: "pee", dogIds: [dog.id] });
  made.push(pee.id);
  await signIn(page);
  await page.goto("/verlauf");
  const row = page.getByTestId(`entry-${pee.id}`);
  await expect(row).toContainText("Pipi");
  await row.click();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${pee.id}`);

  await page.getByRole("button", { name: "Löschen" }).click();
  const ask = page.getByTestId("delete-sheet");
  await expect(ask).toContainText("Eintrag löschen?");
  await ask.getByRole("button", { name: "Abbrechen" }).click();
  await expect(ask).toBeHidden();
  await page.getByRole("button", { name: "Löschen" }).click();
  await ask.getByRole("button", { name: "Ja, löschen" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByTestId(`entry-${pee.id}`)).toHaveCount(0);
  await expect(asHirsch().entry({ id: pee.id })).rejects.toMatchObject({ status: 404 });
});

test("filtered by Herzii, the walk she went on stays and Hirsch's feeding goes; the walk shows what happened and opens its summary", async ({ page }) => {
  const client = asHirsch();
  const herzii = (await client.people()).people.find((p) => p.name === "Herzii")!;
  const key = `history-walk-${Date.now()}`;
  const dog = await firstDog();
  // hours ago: a start while another walk ran would join that one (other specs walk now)
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(360), kind: "walk.start", walkKey: key },
      { id: `${key}-pee`, at: minutesAgo(350), kind: "log", type: "pee", dogId: dog.id },
      { id: `${key}-stop`, at: minutesAgo(332), kind: "walk.stop", walkKey: key },
    ],
  });
  const walk = (await client.walkByKey({ key })).summary;
  expect((await client.entry({ id: walk.id })).clientKey).toBe(key);
  const me = (await client.me()).person;
  await client.editEntry({ id: walk.id, at: walk.startedAt, endedAt: walk.endedAt, walkers: [me.id, herzii.id] });
  const pee = (await client.entries({ type: "pee" })).entries.find((e) => e.at === walk.pees[0]?.at)!;
  const food = await client.logEntry({ type: "food", foodKind: "dry", amountG: 47 });
  made.push(walk.id, pee.id, food.id);

  await signIn(page);
  await page.goto("/verlauf");
  const walkRow = page.getByTestId(`entry-${walk.id}`);
  await expect(walkRow).toContainText("28 Min.");
  await expect(walkRow).toContainText("💧 1");
  await expect(walkRow).toContainText("Hirsch + Herzii");
  await expect(page.getByTestId(`entry-${food.id}`)).toBeVisible();

  await page.getByRole("button", { name: "Wer: Alle" }).click();
  await page.getByTestId("filter-sheet").getByRole("button", { name: "Herzii" }).click();
  await expect(page.getByRole("button", { name: "Wer: Herzii" })).toBeVisible();
  await expect(page.getByTestId(`entry-${food.id}`)).toHaveCount(0);
  await expect(walkRow).toBeVisible();

  await walkRow.click();
  await expect(page).toHaveURL(`${BASE_URL}/runde/${walk.id}`);
  await expect(page.getByTestId("summary-pees")).toContainText("1×");
});

test("a training reads Sitz 2/3 in the list; its repetitions are changed in its detail", async ({ page }) => {
  const client = asHirsch();
  const sitz = (await client.exercises()).exercises.find((e) => e.name === "Sitz") ?? (await client.addExercise({ name: "Sitz" }));
  const dog = await firstDog();
  const key = `history-training-${Date.now()}`;
  const rep = (n: number, ok: boolean) => ({ id: `${key}-${n}`, at: minutesAgo(10 - n), kind: "training.rep" as const, trainingKey: key, exerciseId: sitz.id, dogId: dog.id, ok, delta: 1 as const });
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(10), kind: "training.start", trainingKey: key, dogIds: [dog.id] },
      rep(1, true),
      rep(2, true),
      rep(3, false),
      { id: `${key}-stop`, at: minutesAgo(5), kind: "training.stop", trainingKey: key },
    ],
  });
  const training = (await client.entries({ type: "training" })).entries.find((e) => e.clientKey === key)!;
  made.push(training.id);

  await signIn(page);
  await page.goto("/verlauf");
  const row = page.getByTestId(`entry-${training.id}`);
  await expect(row).toContainText("Sitz 2/3");
  await row.click();
  await expect(page).toHaveURL(`${BASE_URL}/eintrag/${training.id}`);
  await page.getByRole("button", { name: "Sitz klappt: eins mehr" }).click();
  await expect(page.getByTestId("edit-training-summary")).toHaveText("Sitz 3/4");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(row).toContainText("Sitz 3/4");
  expect((await client.entry({ id: training.id })).exercises).toEqual([{ name: "Sitz", ok: 3, fail: 1 }]);
});
