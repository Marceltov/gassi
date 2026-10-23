// Notes and encounters (#91, #90, #37): from Start at home, and on a walk, also without reception; put right in Verlauf.
import { createClient } from "@gassi/api-client";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, onlyOneDog, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const made: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

/** The newest entry of `type`, once the server has it. */
async function newest(token: string, type: string) {
  const client = createClient({ baseUrl: BASE_URL, token });
  await expect.poll(async () => (await client.entries({ type })).entries.length).toBeGreaterThan(0);
  const entry = (await client.entries({ type })).entries[0];
  made.push(entry.id);
  return entry;
}

test("Start: a note is its text; a person encounter needs who and how it went, and keeps mood, sounds and where", async ({ page }) => {
  const restore = await onlyOneDog();
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Notiz", exact: true }).click();
    const sheet = page.getByTestId("log-sheet");
    await expect(sheet.getByRole("button", { name: "Eintragen" })).toBeDisabled();
    await sheet.getByLabel("Notiz").fill("Ruhig, als der Besuch kam");
    await sheet.getByRole("button", { name: "Eintragen" }).click();
    await expect(sheet).toHaveCount(0);
    expect(await newest(token, "note")).toMatchObject({ note: "Ruhig, als der Besuch kam", dogIds: [] });

    await page.getByRole("button", { name: "Begegnung", exact: true }).click();
    await page.getByTestId("encounter-choice").getByRole("button", { name: "Mensch" }).click();
    await sheet.getByLabel("Wer?").fill("Oma Inge");
    await expect(sheet.getByRole("button", { name: "Eintragen" })).toBeDisabled(); // how it went is still missing
    await sheet.getByRole("tab", { name: "7", exact: true }).first().click();
    await sheet.getByRole("button", { name: "freundlich" }).click();
    await sheet.getByRole("button", { name: "aufgeregt" }).click();
    await sheet.getByRole("button", { name: "knurrt" }).click();
    await sheet.getByRole("button", { name: "jault" }).click();
    await sheet.getByLabel("Notiz zur Begegnung").fill("an der Tür");
    await sheet.getByRole("button", { name: "Eintragen" }).click();
    expect(await newest(token, "personEncounter")).toMatchObject({ note: "an der Tür", details: { who: "Oma Inge", place: "home", rating: 7, moods: ["friendly", "excited"], sounds: ["growls", "howls"] } });
  } finally {
    await restore();
  }
});

test("on a walk without reception: a dog encounter shows in the walk's list at once and reaches the server later; Verlauf changes it", async ({ page, context }) => {
  const restore = await onlyOneDog();
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Gassi gehen" }).click();
    await expect(page.getByTestId("walk-clock")).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Begegnung", exact: true }).click();
    await page.getByTestId("encounter-choice").getByRole("button", { name: "Hund" }).click();
    const sheet = page.getByTestId("log-sheet");
    await sheet.getByRole("tab", { name: "2 fiept" }).click();
    await sheet.getByRole("button", { name: "kreischt" }).click();
    await sheet.getByRole("button", { name: "großer Bogen" }).click();
    await sheet.getByRole("tab", { name: "nah" }).click();
    await sheet.getByRole("button", { name: "Eintragen" }).click();
    await expect(page.getByTestId("walk-taps")).toContainText("Hundebegegnung · 2 fiept · kreischt · großer Bogen · nah");
    await context.setOffline(false);
    const entry = await newest(token, "dogEncounter");
    expect(entry.details).toEqual({ reaction: 2, sounds: ["screeches"], handling: "wideBerth", distance: "near" });
    await page.getByRole("button", { name: "Zuhause" }).click();
    await expect(page.getByTestId("summary-counts")).toHaveText("1 Begegnung");

    await page.goto(`/verlauf/eintrag/${entry.id}`);
    await page.getByRole("tab", { name: "4 explodiert" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect.poll(async () => (await createClient({ baseUrl: BASE_URL, token }).entry({ id: entry.id })).details).toEqual({ reaction: 4, sounds: ["screeches"], handling: "wideBerth", distance: "near" });
  } finally {
    await restore();
  }
});

test("with two dogs, Begegnung asks the dog first, like Pipi, and the form is about that dog", async ({ page }) => {
  const token = await signIn(page);
  const dogs = (await asHirsch().dogs()).dogs.filter((d) => !d.archived);
  expect(dogs.length).toBeGreaterThan(1);
  await page.goto("/");
  await page.getByRole("button", { name: "Begegnung", exact: true }).click();
  await page.getByTestId("encounter-choice").getByRole("button", { name: "Hund" }).click();
  await page.getByTestId("dog-choice").getByRole("button", { name: dogs[1].name }).click();
  const sheet = page.getByTestId("log-sheet");
  await expect(sheet.getByRole("button", { name: dogs[0].name })).toHaveCount(0);
  await sheet.getByRole("tab", { name: "0 ruhig" }).click();
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  expect((await newest(token, "dogEncounter")).dogIds).toEqual([dogs[1].id]);
});

test("Kommando and Leckerli, on a walk and at home: one or two taps, counted like a training's", async ({ page }) => {
  const restore = await onlyOneDog();
  const api = asHirsch();
  const warten = await api.addExercise({ name: `Warten ${Date.now()}` });
  const kaese = await api.addTreatKind({ name: `Käse ${Date.now()}`, gramsPerPiece: 2, fromDry: false });
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Gassi gehen" }).click();
    await page.getByRole("button", { name: "Kommando", exact: true }).click();
    const command = page.getByTestId("command-sheet");
    await command.getByRole("button", { name: warten.name }).click();
    await command.getByRole("button", { name: `+ 1 ${kaese.name}` }).click();
    await expect(command.getByRole("button", { name: `+ 1 ${kaese.name}` })).toHaveAttribute("aria-pressed", "true");
    await command.getByRole("button", { name: "klappt", exact: true }).click();
    await expect(page.getByTestId("walk-taps")).toContainText(`Kommando · ${warten.name} ✓ · 1 Leckerli`);
    const entry = await newest(token, "command");
    expect(entry).toMatchObject({ exercises: [{ name: warten.name, ok: 1, fail: 0 }], treats: 1 });

    // the next one has the exercise and treat preset: one tap
    await page.getByRole("button", { name: "Kommando", exact: true }).click();
    await command.getByRole("button", { name: "klappt nicht" }).click();
    await expect(page.getByTestId("walk-taps")).toContainText(`Kommando · ${warten.name} ✗`);
    made.push((await newest(token, "command")).id);
    await page.getByRole("button", { name: "Zuhause" }).click();

    // at home: Leckerli asks the kind, the last one marked
    await page.goto("/");
    await page.getByRole("button", { name: "Leckerli", exact: true }).click();
    await page.getByTestId("treat-sheet").getByRole("button", { name: kaese.name }).click();
    expect((await newest(token, "treat")).treatCounts).toEqual([{ treatKindId: kaese.id, count: 1 }]);
  } finally {
    await api.updateExercise({ id: warten.id, archived: true });
    await api.updateTreatKind({ id: kaese.id, archived: true });
    await restore();
  }
});
