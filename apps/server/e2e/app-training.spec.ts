// The training screen: ✓/✗ per repetition and exercise, a long press undoes the last (also without reception),
// treats, Fertig, and the dog question when several dogs train.
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, onlyOneDog, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

/** Sitz and a treat kind, created when the household has none (other specs may have made them already). */
async function household() {
  const client = asHirsch();
  const exercise = (await client.exercises()).exercises.find((e) => e.name === "Sitz") ?? (await client.addExercise({ name: "Sitz" }));
  const treat = (await client.treatKinds()).treatKinds[0] ?? (await client.addTreatKind({ name: "Käse", gramsPerPiece: 2, fromDry: false }));
  return { client, exercise, treat };
}

const entryOf = async (client: ReturnType<typeof createClient>, key: string) => (await client.entries({ type: "training" })).entries.find((e) => e.clientKey === key);

test("✓ ✓ ✗ and a treat count per exercise; a long press undoes the last, also without reception; Fertig saves", async ({ page, context }) => {
  const restore = await onlyOneDog();
  try {
    const { client, treat } = await household();
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Training starten" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/training`);
    await expect(page.getByTestId("training-clock")).toHaveText(/^\d+:\d\d$/);
    const line = page.getByTestId("training-summary");
    await expect(line).toHaveText("Noch nichts");

    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await page.getByRole("button", { name: "Sitz", exact: true }).click();
    await page.getByRole("button", { name: "Sitz klappt", exact: true }).click();
    await page.getByRole("button", { name: "Sitz klappt", exact: true }).click();
    await page.getByRole("button", { name: "Sitz klappt nicht" }).click();
    await expect(line).toHaveText("Sitz 2/3");

    // a second ✗ by mistake, undone by a long press, without reception
    await context.setOffline(true);
    await page.getByRole("button", { name: "Sitz klappt nicht" }).click();
    await expect(line).toHaveText("Sitz 2/4");
    await page.getByRole("button", { name: "Sitz klappt nicht" }).click({ delay: 700 });
    await expect(line).toHaveText("Sitz 2/3");
    await page.getByRole("button", { name: `${treat.name} +1` }).click();
    await expect(line).toHaveText("Sitz 2/3 · 1 Leckerli");
    await context.setOffline(false);

    const key = (await asHirsch().sessions()).training?.key;
    expect(key).toBeTruthy();
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps).toEqual([expect.objectContaining({ ok: 2, fail: 1 })]);

    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect.poll(async () => (await entryOf(client, key!))?.exercises).toEqual([{ name: "Sitz", ok: 2, fail: 1 }]);
    expect((await entryOf(client, key!))?.treats).toBe(1);
  } finally {
    await restore();
  }
});

test("with several dogs ✓ asks for the dog; Fertig on a walk's training leads back to the walk", async ({ page }) => {
  const { client } = await household();
  const luna = await client.addDog({ name: "Luna", color: "#7a4fc0" });
  try {
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Gassi gehen" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/runde`);
    await page.getByRole("button", { name: "🎯 Training", exact: true }).click();
    await expect(page).toHaveURL(`${BASE_URL}/training`);
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await page.getByRole("button", { name: "Sitz", exact: true }).click();
    await page.getByRole("button", { name: "Sitz klappt", exact: true }).click();
    const choice = page.getByTestId("dog-choice");
    await expect(choice.getByRole("button", { name: "Luna" })).toBeVisible();
    await choice.getByRole("button", { name: "Luna" }).click();
    await expect(page.getByTestId("training-summary")).toHaveText("Sitz 1/1");
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps).toEqual([expect.objectContaining({ dogId: luna.id, ok: 1, fail: 0 })]);

    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/runde`);
    await expect.poll(async () => (await asHirsch().sessions()).training).toBeNull();
  } finally {
    await client.updateDog({ id: luna.id, archived: true });
  }
});
