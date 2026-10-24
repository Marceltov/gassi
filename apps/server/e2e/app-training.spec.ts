// The training screen: ✓/✗ per repetition and exercise, a long press undoes the last (also without reception),
// treats, Fertig, and the dog question when several dogs train.
import { createClient } from "@gassi/api-client";
import { expect, type Locator, type Page, test } from "@playwright/test";
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

/** A long press: holds `button` down until `done` passes (the press did its work, however long that took), then lets
 * go. */
async function longPress(page: Page, button: Locator, done: () => Promise<void>) {
  await button.hover();
  await page.mouse.down();
  try {
    await done();
  } finally {
    await page.mouse.up();
  }
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
    await expect(line).toHaveText("Sitz ✓2 ~0 ✗1");

    // a second ✗ by mistake, undone by a long press, without reception
    await context.setOffline(true);
    await page.getByRole("button", { name: "Sitz klappt nicht" }).click();
    await expect(line).toHaveText("Sitz ✓2 ~0 ✗2");
    await longPress(page, page.getByRole("button", { name: "Sitz klappt nicht" }), () => expect(line).toHaveText("Sitz ✓2 ~0 ✗1"));
    await expect(line).toHaveText("Sitz ✓2 ~0 ✗1"); // letting go is no tap
    await page.getByRole("button", { name: `${treat.name} +1` }).click();
    await expect(line).toHaveText("Sitz ✓2 ~0 ✗1 · 1 Leckerli");
    await context.setOffline(false);
    // worked, but could be better: its own count (#100)
    await page.getByRole("button", { name: "Sitz klappt, aber könnte besser sein" }).click();
    await expect(line).toHaveText("Sitz ✓2 ~1 ✗1 · 1 Leckerli");

    const key = (await asHirsch().sessions()).training?.key;
    expect(key).toBeTruthy();
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps).toEqual([expect.objectContaining({ ok: 2, meh: 1, fail: 1 })]);

    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect.poll(async () => (await entryOf(client, key!))?.exercises).toEqual([{ name: "Sitz", ok: 2, meh: 1, fail: 1 }]);
    expect((await entryOf(client, key!))?.treats).toBe(1);
  } finally {
    await restore();
  }
});

test("+ Übung offers the exercises not shown yet and a new one; a new one needs reception and then shows", async ({ page, context }) => {
  const { client } = await household();
  const name = `Pfote ${Date.now()}`;
  const restore = await onlyOneDog();
  try {
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Training starten" }).click();
    await expect(page.getByText("„+ Übung“ wählt eine aus oder legt eine an")).toBeVisible();
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    const picker = page.getByTestId("exercise-picker");
    await expect(picker.getByRole("button", { name: "Sitz", exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "Sitz", exact: true }).click();
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await expect(picker.getByRole("button", { name: "Sitz", exact: true })).toHaveCount(0); // shown already

    // without reception a new exercise can't be made
    await context.setOffline(true);
    await picker.getByRole("button", { name: "Neue Übung …" }).click();
    await page.getByLabel("Name der Übung").fill(name);
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByTestId("exercise-message")).toHaveText("Keine Verbindung – bitte später nochmal.");
    await context.setOffline(false);

    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByTestId("exercise-new")).toBeHidden();
    await page.getByRole("button", { name: `${name} klappt`, exact: true }).click();
    await expect(page.getByTestId("training-summary")).toHaveText(`${name} ✓1 ~0 ✗0`);
    expect((await client.exercises()).exercises.some((e) => e.name === name)).toBe(true);

    // the name of one the household has already (in other letters) shows that one, without a second
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await picker.getByRole("button", { name: "Neue Übung …" }).click();
    await page.getByLabel("Name der Übung").fill(name.toUpperCase());
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByTestId("exercise-new")).toBeHidden();
    expect((await client.exercises()).exercises.filter((e) => e.name.toLowerCase() === name.toLowerCase())).toHaveLength(1);
  } finally {
    await restore();
    const made = (await client.exercises()).exercises.find((e) => e.name === name);
    if (made) await client.updateExercise({ id: made.id, archived: true });
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
    await page.getByRole("button", { name: "Training", exact: true }).click();
    await expect(page).toHaveURL(`${BASE_URL}/training`);
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await page.getByRole("button", { name: "Sitz", exact: true }).click();
    await page.getByRole("button", { name: "Sitz klappt", exact: true }).click();
    const choice = page.getByTestId("dog-choice");
    await expect(choice.getByRole("button", { name: "Luna" })).toBeVisible();
    await choice.getByRole("button", { name: "Luna" }).click();
    await expect(page.getByTestId("training-summary")).toHaveText("Sitz ✓1 ~0 ✗0");
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps).toEqual([expect.objectContaining({ dogId: luna.id, ok: 1, meh: 0, fail: 0 })]);

    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/runde`);
    await expect.poll(async () => (await asHirsch().sessions()).training).toBeNull();
    // back to the walk it was started from, not a second walk screen on top of it; Zuhause, then Fertig, is Start
    await expect(page.getByTestId("walk-clock")).toHaveCount(1);
    await page.getByRole("button", { name: "Zuhause" }).click();
    await expect(page).toHaveURL(/\/runde\/[^/]+$/);
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByTestId("walk-clock")).toHaveCount(0);
  } finally {
    await client.updateDog({ id: luna.id, archived: true });
  }
});

test("with several dogs a long press after a reload asks which dog to undo, among the dogs with a count", async ({ page }) => {
  const { client } = await household();
  const luna = await client.addDog({ name: "Luna", color: "#7a4fc0" });
  try {
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Training starten" }).click();
    await page.getByRole("button", { name: "Übung hinzufügen" }).click();
    await page.getByRole("button", { name: "Sitz", exact: true }).click();
    const choice = page.getByTestId("dog-choice");
    for (const dog of ["Luna", "Toffee", "Toffee"]) {
      await page.getByRole("button", { name: "Sitz klappt", exact: true }).click();
      await choice.getByRole("button", { name: dog }).click();
    }
    await expect(page.getByTestId("training-summary")).toHaveText("Sitz ✓3 ~0 ✗0");
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps.length).toBe(2);

    await page.reload(); // the last tap is forgotten: asks, offering the dogs that have a count
    await expect(page.getByTestId("training-summary")).toHaveText("Sitz ✓3 ~0 ✗0");
    await longPress(page, page.getByRole("button", { name: "Sitz klappt", exact: true }), () => expect(choice.getByRole("button", { name: "Luna" })).toBeVisible());
    await expect(choice.getByRole("button", { name: "Toffee" })).toBeVisible();
    await choice.getByRole("button", { name: "Luna" }).click();
    await expect(page.getByTestId("training-summary")).toHaveText("Sitz ✓2 ~0 ✗0");
    await expect.poll(async () => (await asHirsch().sessions()).training?.reps.map((r) => [r.dogId === luna.id ? "Luna" : "other", r.ok]).sort()).toEqual([["Luna", 0], ["other", 2]]);
  } finally {
    await client.updateDog({ id: luna.id, archived: true });
  }
});

test("at 360×640 Fertig stays visible with four exercises and three treat kinds", async ({ page }) => {
  const { client } = await household();
  const names = ["Sitz", "Platz", "Bleib", "Hier"];
  const have = (await client.exercises()).exercises.map((e) => e.name);
  for (const n of names) if (!have.includes(n)) await client.addExercise({ name: n });
  const haveKinds = (await client.treatKinds()).treatKinds.map((k) => k.name);
  for (const n of ["Käse", "Wurst", "Trocken"]) if (haveKinds.length < 3 && !haveKinds.includes(n)) await client.addTreatKind({ name: n, gramsPerPiece: 2, fromDry: false });
  const restore = await onlyOneDog();
  try {
    await page.setViewportSize({ width: 360, height: 640 });
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Training starten" }).click();
    for (const n of names) {
      await page.getByRole("button", { name: "Übung hinzufügen" }).click();
      await page.getByRole("button", { name: n, exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Fertig" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: "../../.superpowers/sdd/2026-10-21-gassi-step2b-app/task-7-training-360x640.png" });
  } finally {
    await restore();
  }
});
