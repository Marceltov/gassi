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

test("Kommando and Leckerli on a walk: a tap gives the usual Leckerli and asks only klappt or klappt nicht for the usual command, a hold chooses (#36, #98, #114)", async ({ page }) => {
  const restore = await onlyOneDog();
  const api = asHirsch();
  const warten = await api.addExercise({ name: `Warten ${Date.now()}` });
  const kaese = await api.addTreatKind({ name: `Käse ${Date.now()}`, gramsPerPiece: 2, fromDry: false, training: true });
  // a second kind, so that Leckerli asks which (with one kind it just logs it)
  const huhn = await api.addTreatKind({ name: `Huhn ${Date.now()}`, gramsPerPiece: 1, fromDry: false, training: true });
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Gassi gehen" }).click();
    const taps = page.getByTestId("walk-taps");
    // nothing usual yet: the tap asks
    await page.getByRole("button", { name: "Kommando", exact: true }).click();
    const command = page.getByTestId("command-sheet");
    await command.getByRole("button", { name: warten.name }).click();
    // the first kind is preset; this one is chosen unless it is that one
    const withKaese = command.getByRole("button", { name: `+ 1 ${kaese.name}` });
    if ((await withKaese.getAttribute("aria-pressed")) !== "true") await withKaese.click();
    await expect(withKaese).toHaveAttribute("aria-pressed", "true");
    await command.getByRole("button", { name: "klappt", exact: true }).click();
    await expect(taps).toContainText(`Kommando · ${warten.name} ✓ · 1 Leckerli`);
    const entry = await newest(token, "command");
    expect(entry).toMatchObject({ exercises: [{ name: warten.name, ok: 1, fail: 0 }], treats: 1 });

    // now a tap on Kommando asks only whether the usual worked, saying what ✓ gives (#114); nothing is logged before
    // Kommando names only the exercise: its treat is the one under Leckerli (#141)
    const kommando = page.getByRole("button", { name: `Kommando, ${warten.name}`, exact: true });
    const leckerli = page.getByRole("button", { name: `Leckerli, ${kaese.name}` });
    const ask = page.getByTestId("command-ask");
    await kommando.click();
    await expect(command).toBeHidden();
    await expect(ask).toContainText(warten.name);
    await expect(ask).toContainText(`bei ✓ mit ${kaese.name}`);
    await expect(taps.getByText(`Kommando · ${warten.name} ✓ · 1 Leckerli`)).toHaveCount(1);
    await ask.getByRole("button", { name: "klappt", exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(taps.getByText(`Kommando · ${warten.name} ✓ · 1 Leckerli`)).toHaveCount(2);
    // ✗ logs it without the Leckerli
    await kommando.click();
    await ask.getByRole("button", { name: "klappt nicht" }).click();
    await expect(taps.getByText(`Kommando · ${warten.name} ✗`, { exact: true })).toHaveCount(1);
    await leckerli.click();
    await expect(taps).toContainText(`Leckerli · ${kaese.name}`);
    await expect(page.getByTestId("treat-sheet")).toBeHidden();
    await expect.poll(async () => (await createClient({ baseUrl: BASE_URL, token }).entries({ type: "treat" })).entries[0]?.treatCounts).toEqual([{ treatKindId: kaese.id, count: 1 }]);

    // a hold chooses: a command that didn't work, another Leckerli that is then the one on you, for both buttons
    await kommando.click({ delay: 800 });
    await command.getByRole("button", { name: "klappt nicht" }).click();
    await expect(taps.getByText(`Kommando · ${warten.name} ✗`, { exact: true })).toHaveCount(2);
    await leckerli.click({ delay: 800 });
    await page.getByTestId("treat-sheet").getByRole("button", { name: huhn.name }).click();
    await expect(taps).toContainText(`Leckerli · ${huhn.name}`);
    await expect(page.getByRole("button", { name: `Leckerli, ${huhn.name}` })).toBeVisible();
    await expect(kommando).toBeVisible();
    // the three words of the row sit at one height, Begegnung's too, though it has no small line
    const tops = await Promise.all(["Kommando", "Leckerli", "Begegnung"].map(async (w) => (await page.getByText(w, { exact: true }).last().boundingBox())!.y));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    // every one of them goes again afterwards
    const client = createClient({ baseUrl: BASE_URL, token });
    for (const type of ["command", "treat"]) made.push(...(await client.entries({ type })).entries.filter((e) => e.at >= entry.at).map((e) => e.id));
    await page.getByRole("button", { name: "Zuhause" }).click();

    // at home: Leckerli asks the kind, the last one marked
    await page.goto("/");
    await page.getByRole("button", { name: "Leckerli", exact: true }).click();
    await page.getByTestId("treat-sheet").getByRole("button", { name: kaese.name }).click();
    expect((await newest(token, "treat")).treatCounts).toEqual([{ treatKindId: kaese.id, count: 1 }]);
  } finally {
    await api.updateExercise({ id: warten.id, archived: true });
    await api.updateTreatKind({ id: kaese.id, archived: true });
    await api.updateTreatKind({ id: huhn.id, archived: true });
    await restore();
  }
});

test("with two dogs on a walk, a tap on Kommando asks klappt or klappt nicht in a row per dog (#114)", async ({ page }) => {
  const api = asHirsch();
  const dogs = (await api.dogs()).dogs.filter((d) => !d.archived);
  expect(dogs.length).toBeGreaterThan(1);
  const warten = await api.addExercise({ name: `Warten ${Date.now()}` });
  try {
    const token = await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Gassi gehen" }).click();
    // nothing usual yet: the dog, then the form
    await page.getByRole("button", { name: "Kommando", exact: true }).click();
    await page.getByTestId("dog-choice").getByRole("button", { name: dogs[0].name }).click();
    const command = page.getByTestId("command-sheet");
    await command.getByRole("button", { name: warten.name }).click();
    await command.getByRole("button", { name: "klappt", exact: true }).click();
    await expect(command).toBeHidden();

    await page.getByRole("button", { name: `Kommando, ${warten.name}`, exact: true }).click();
    await expect(page.getByTestId("dog-choice")).toBeHidden();
    const ask = page.getByTestId("command-ask");
    await expect(ask.getByRole("button", { name: `${dogs[0].name} klappt`, exact: true })).toBeVisible();
    await ask.getByRole("button", { name: `${dogs[1].name} klappt nicht` }).click();
    await expect(ask).toBeHidden();
    await expect.poll(async () => (await newest(token, "command")).dogIds).toEqual([dogs[1].id]);
    expect(await newest(token, "command")).toMatchObject({ exercises: [{ name: warten.name, ok: 0, fail: 1 }], treats: 0 });
    const client = createClient({ baseUrl: BASE_URL, token });
    made.push(...(await client.entries({ type: "command" })).entries.filter((e) => e.exercises?.some((x) => x.name === warten.name)).map((e) => e.id));
  } finally {
    await api.updateExercise({ id: warten.id, archived: true });
  }
});
