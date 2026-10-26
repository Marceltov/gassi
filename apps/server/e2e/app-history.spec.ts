// Verlauf: what happened, newest first, grouped by day; an entry opens to be changed or deleted, a walk opens its
// summary; filters by person, type and dog. Each test makes its own entries and looks only at those (the server is
// shared), and deletes what it made.
import { utcToLocal } from "@gassi/domain";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { expectFits } from "./fit";
import { asHirsch, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const made: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
});

// whole minutes, so a time typed into a minute field lands on the same instant
const minutesAgo = (n: number) => new Date(Math.floor(Date.now() / 60_000) * 60_000 - n * 60_000).toISOString();
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
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${food.id}`);
  await expect(page.getByTestId("edit-amount")).toHaveText("123 g");
  await page.getByRole("button", { name: "10 g mehr" }).click();
  await expect(page.getByTestId("edit-amount")).toHaveText("133 g");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Keine Verbindung – bitte später nochmal.")).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${food.id}`);
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
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${pee.id}`);

  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  const ask = page.getByTestId("delete-sheet");
  await expect(ask).toContainText("Eintrag löschen?");
  await ask.getByRole("button", { name: "Abbrechen" }).click();
  await expect(ask).toBeHidden();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await ask.getByRole("button", { name: "Ja, löschen" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByTestId(`entry-${pee.id}`)).toHaveCount(0);
  await expect(asHirsch().entry({ id: pee.id })).rejects.toMatchObject({ status: 404 });
});

/** A walk with one pee, `hoursAgo` back (a start while another walk ran would join that one; other specs walk now). */
async function pastWalk(hoursAgo: number) {
  const client = asHirsch();
  const key = `history-walk-${hoursAgo}-${Date.now()}`;
  const dog = await firstDog();
  const from = hoursAgo * 60;
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(from), kind: "walk.start", walkKey: key },
      { id: `${key}-pee`, at: minutesAgo(from - 10), kind: "log", type: "pee", dogId: dog.id },
      { id: `${key}-stop`, at: minutesAgo(from - 28), kind: "walk.stop", walkKey: key },
    ],
  });
  const walk = (await client.walkByKey({ key })).summary;
  expect((await client.entry({ id: walk.id })).clientKey).toBe(key);
  made.push(walk.id, walk.pees[0].id);
  return walk;
}

test("filtered by Herzii, the walk she went on stays and Hirsch's feeding goes; the walk shows what happened and opens its summary", async ({ page }) => {
  const client = asHirsch();
  const herzii = (await client.people()).people.find((p) => p.name === "Herzii")!;
  const walk = await pastWalk(6);
  const me = (await client.me()).person;
  await client.editEntry({ id: walk.id, at: walk.startedAt, endedAt: walk.endedAt, walkers: [me.id, herzii.id] });
  const food = await client.logEntry({ type: "food", foodKind: "dry", amountG: 47 });
  made.push(food.id);

  await signIn(page);
  await page.goto("/verlauf");
  await expect(page.getByTestId(`entry-${food.id}`)).toBeVisible();

  // only Herzii's entries: few, so her walk is on the first page whatever other specs logged
  await page.getByRole("button", { name: "Wer: Alle" }).click();
  await page.getByTestId("filter-sheet").getByRole("button", { name: "Herzii" }).click();
  await expect(page.getByRole("button", { name: "Wer: Herzii" })).toBeVisible();
  await expect(page.getByTestId(`entry-${food.id}`)).toHaveCount(0);
  const walkRow = page.getByTestId(`entry-${walk.id}`);
  await expect(walkRow).toContainText("Gassi");
  await expect(page.getByTestId(`entry-${walk.id}-extra`)).toContainText("28 Min.");
  await expect(page.getByTestId(`entry-${walk.id}-more`)).toContainText("1× Pipi");
  await expect(walkRow).toContainText("Hirsch + Herzii");

  await walkRow.click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/runde/${walk.id}`);
  await expect(page.getByTestId("summary-counts")).toHaveText("1× Pipi");
  // opened from Verlauf, the summary stays on Verlauf's tab, and Fertig goes back to the filtered list
  await expect(page.getByRole("tab", { name: "Verlauf" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByRole("button", { name: "Wer: Herzii" })).toBeVisible();
});

test("a filter's choices are one list: Alle first, every option as wide, the chosen one marked", async ({ page }) => {
  await signIn(page);
  await page.goto("/verlauf");
  await page.getByRole("button", { name: "Was: Alles" }).click();
  const sheet = page.getByTestId("filter-sheet");
  const options = sheet.getByRole("button");
  await expect(options.first()).toHaveAccessibleName("Alles");
  await expect(options.first()).toHaveAttribute("aria-pressed", "true");
  await expect(options.first().getByTestId("choice-mark")).toBeVisible();
  await expect(options.nth(1).getByTestId("choice-mark")).toHaveCount(0);
  const boxes = await Promise.all((await options.all()).map((o) => o.boundingBox()));
  expect(new Set(boxes.map((b) => Math.round(b!.width))).size).toBe(1); // as wide as each other
  expect(new Set(boxes.map((b) => Math.round(b!.x))).size).toBe(1); // one below the other
  await sheet.getByRole("button", { name: "Futter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Was: Futter" })).toBeVisible();
  await page.getByRole("button", { name: "Was: Futter" }).click();
  await expect(sheet.getByRole("button", { name: "Futter", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: "Alles", exact: true })).toHaveAttribute("aria-pressed", "false");
  await sheet.getByRole("button", { name: "Alles", exact: true }).click();
  await expect(page.getByRole("button", { name: "Was: Alles" })).toBeVisible();
});

test("a Start tile opens Verlauf filtered to its type, which a reload keeps, Alles clears and a tap on the Verlauf tab clears with every other filter", async ({ page }) => {
  const dog = await firstDog();
  const pee = await asHirsch().logEntry({ type: "pee", dogIds: [dog.id] });
  const food = await asHirsch().logEntry({ type: "food", foodKind: "dry", amountG: 40 });
  made.push(pee.id, food.id);
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Pipi im Verlauf zeigen, / }).click();

  await expect(page).toHaveURL(`${BASE_URL}/verlauf?type=pee`);
  await expect(page.getByRole("button", { name: "Was: Pipi" })).toBeVisible();
  await expect(page.getByTestId(`entry-${pee.id}`)).toBeVisible();
  await expect(page.getByTestId(`entry-${food.id}`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Was: Pipi" })).toBeVisible();
  await expect(page.getByTestId(`entry-${pee.id}`)).toBeVisible();

  await page.getByRole("button", { name: "Was: Pipi" }).click();
  await page.getByTestId("filter-sheet").getByRole("button", { name: "Alles", exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByTestId(`entry-${food.id}`)).toBeVisible();

  // another tile while Verlauf is open in its tab: the new type is chosen
  await page.getByRole("tab", { name: "Start" }).click();
  await page.getByRole("button", { name: /^Futter im Verlauf zeigen, / }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf?type=food`);
  await expect(page.getByRole("button", { name: "Was: Futter" })).toBeVisible();
  await expect(page.getByTestId(`entry-${pee.id}`)).toHaveCount(0);

  // a tap on the Verlauf tab clears every filter
  await page.getByRole("button", { name: "Wer: Alle" }).click();
  await page.getByTestId("filter-sheet").getByRole("button", { name: "Hirsch" }).click();
  await expect(page.getByRole("button", { name: "Wer: Hirsch" })).toBeVisible();
  await page.getByRole("tab", { name: "Verlauf" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByRole("button", { name: "Was: Alles" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wer: Alle" })).toBeVisible();
  await expect(page.getByTestId(`entry-${pee.id}`)).toBeVisible();
});

test("from a walk's summary: its pee is deleted, its start moved, then the walk deleted, which leads to Verlauf", async ({ page }) => {
  const walk = await pastWalk(8);
  const pee = walk.pees[0];
  await signIn(page);
  await page.goto(`/verlauf/runde/${walk.id}`);
  await expect(page.getByTestId("summary-counts")).toHaveText("1× Pipi");

  await page.getByTestId(`summary-mark-${pee.id}`).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${pee.id}`);
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByTestId("delete-sheet").getByRole("button", { name: "Ja, löschen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/runde/${walk.id}`);
  await expect(page.getByTestId("summary-counts")).toHaveText("Noch nichts");

  // ten minutes earlier, typed as this phone's local time (the page runs in Europe/Berlin)
  const earlier = utcToLocal(Date.parse(walk.startedAt) - 10 * 60_000, "Europe/Berlin");
  await page.getByRole("button", { name: "Zeit, Hunde, Löschen …" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${walk.id}`);
  await page.getByLabel("Beginn").fill(earlier);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/runde/${walk.id}`);
  await expect(page.getByText(`Runde ${earlier.slice(11)}–`)).toBeVisible();
  await expect(page.getByText("38 Min.")).toBeVisible();

  await page.getByRole("button", { name: "Zeit, Hunde, Löschen …" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${walk.id}`);
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByTestId("delete-sheet").getByRole("button", { name: "Ja, löschen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(page.getByTestId(`entry-${walk.id}`)).toHaveCount(0);
  await expect(asHirsch().entry({ id: walk.id })).rejects.toMatchObject({ status: 404 });
});

test("a training reads Sitz 2/3 in the list; its repetitions are changed in its detail", async ({ page }) => {
  const client = asHirsch();
  const sitz = (await client.exercises()).exercises.find((e) => e.name === "Sitz") ?? (await client.addExercise({ name: "Sitz" }));
  if (!(await client.treatKinds()).treatKinds.length) await client.addTreatKind({ name: "Käse", gramsPerPiece: 2, fromDry: false, training: true });
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
  // a line per exercise under the minutes, not one line cut short
  await expect(page.getByTestId(`entry-${training.id}-line`)).toHaveText(["Sitz 2/3"]);
  await row.click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${training.id}`);
  await page.getByRole("button", { name: "Sitz klappt: eins mehr" }).click();
  await expect(page.getByTestId("fact-sub")).toHaveText("Sitz 3/4");
  // exercises and treats in sections of their own
  await expect(page.getByTestId("training-exercises").getByText("Übungen", { exact: true })).toBeVisible();
  await expect(page.getByTestId("training-treats").getByText("Leckerli", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/verlauf`);
  await expect(row).toContainText("Sitz 3/4");
  expect((await client.entry({ id: training.id })).exercises).toEqual([{ name: "Sitz", ok: 3, fail: 1 }]);
});

test("a walk's summary counts what happened, lists it by time, and a training opens its detail", async ({ page }) => {
  const client = asHirsch();
  const dog = await firstDog();
  const key = `history-summary-${Date.now()}`;
  await client.commands({
    commands: [
      { id: `${key}-start`, at: minutesAgo(300), kind: "walk.start", walkKey: key },
      { id: `${key}-pee`, at: minutesAgo(295), kind: "log", type: "pee", dogId: dog.id },
      { id: `${key}-t`, at: minutesAgo(290), kind: "training.start", trainingKey: `${key}-t`, walkKey: key },
      { id: `${key}-t-stop`, at: minutesAgo(285), kind: "training.stop", trainingKey: `${key}-t` },
      { id: `${key}-poop`, at: minutesAgo(280), kind: "log", type: "poop", dogId: dog.id },
      { id: `${key}-stop`, at: minutesAgo(270), kind: "walk.stop", walkKey: key },
    ],
  });
  const walk = (await client.walkByKey({ key })).summary;
  made.push(walk.id, walk.pees[0].id, walk.poops[0].id, walk.trainings[0].id);

  await signIn(page);
  await page.goto(`/verlauf/runde/${walk.id}`);
  await expect(page.getByTestId("summary-counts")).toHaveText("1× Pipi · 1× Poopoo · 1 Training");
  const ids = [`summary-mark-${walk.pees[0].id}`, `summary-training-${walk.trainings[0].id}`, `summary-mark-${walk.poops[0].id}`];
  const tops = await Promise.all(ids.map(async (id) => (await page.getByTestId(id).boundingBox())!.y));
  expect(tops).toEqual([...tops].sort((a, b) => a - b)); // by time
  await page.getByTestId(`summary-training-${walk.trainings[0].id}`).click();
  await expect(page).toHaveURL(`${BASE_URL}/verlauf/eintrag/${walk.trainings[0].id}`);
});

test("Verlauf, an entry and a walk's summary fit a small and a big phone; every row is two lines of one height (a count a line per size, taller) and names its dogs", async ({ page }) => {
  const client = asHirsch();
  const dogs = (await client.dogs()).dogs.filter((d) => !d.archived);
  const food = await client.logEntry({ type: "food", foodKind: "wet", amountG: 120 });
  const pee = await client.logEntry({ type: "pee", dogIds: [dogs[0].id], note: "eine sehr lange Notiz, die in der Zeile abgeschnitten wird statt umzubrechen" });
  const walk = await pastWalk(7);
  made.push(food.id, pee.id);

  await signIn(page);
  await expectFits(page, "/verlauf", "Verlauf");
  const height = async (id: number) => (await page.getByTestId(`entry-${id}`).boundingBox())!.height;
  expect(await height(pee.id)).toBe(await height(food.id)); // a long note is cut short
  expect(await height(walk.id)).toBe(await height(food.id)); // a walk too
  // a count is one row, a line per size: taller, never shorter
  const counted = (await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 200, cans: "1" }, { unitG: 400, cans: "2" }, { unitG: 800, cans: "3" }] })).entries;
  made.push(...counted.map((e) => e.id));
  await page.reload();
  const ids = counted.map((e) => e.id);
  await expect(page.getByTestId(new RegExp(`^entry-(${ids.join("|")})$`))).toHaveCount(1); // one row for the count
  const shown = ids.at(-1)!; // the newest of its rows stands for it
  await expect(page.getByTestId(`entry-${shown}-size`)).toHaveText(["1 × 200 g", "2 × 400 g", "3 × 800 g"]);
  expect(await height(shown)).toBeGreaterThan(await height(food.id));
  // its icon stays at the top, next to its heading and first line, not in the middle of the row
  const [dot, title] = await Promise.all([page.getByTestId(`entry-${shown}-dot`).boundingBox(), page.getByTestId(`entry-${shown}-title`).boundingBox()]);
  expect(dot!.y).toBeLessThan(title!.y + title!.height);
  for (const d of dogs) await expect(page.getByTestId(`entry-${food.id}-more`)).toContainText(d.name); // all of them, too
  await expect(page.getByTestId(`entry-${pee.id}-more`)).toContainText(dogs[0].name);
  // what the entry says is bold, what kind it is isn't
  await expect(page.getByTestId(`entry-${food.id}-extra`)).toHaveCSS("font-weight", "700");
  await expect(page.getByTestId(`entry-${food.id}-title`)).not.toHaveCSS("font-weight", "700");

  await expectFits(page, `/verlauf/eintrag/${food.id}`, "Speichern");
  await expectFits(page, `/verlauf/runde/${walk.id}`, "Fertig");
});

test("a walk's map in Verlauf is wide under its two lines, shows the walk, and leaves the icon and the lines where they are in every row", async ({ page }) => {
  const walk = await pastWalk(2);
  const t = (s: number) => new Date(Date.parse(walk.startedAt) + s * 1000).toISOString();
  // 1,3 km to the north and back
  const points = [0, 650, 1300, 650, 0].map((north, i) => ({ t: t(i * 60), lat: 48.137 + north / 111_195, lon: 11.575 + (i % 2) * 0.004, ele: null, acc: 5 }));
  await asHirsch().uploadTrack({ trackId: `walk-${walk.id}`, walkKey: (await asHirsch().entry({ id: walk.id })).clientKey!, source: "phone", seq: 0, points });

  await signIn(page);
  await page.goto(`${BASE_URL}/verlauf`);
  const thumb = page.getByTestId(`entry-${walk.id}`).getByTestId("track-map");
  const line = thumb.locator("path.leaflet-interactive, path").first();
  await expect(line).toBeVisible();
  const [box, drawn] = await Promise.all([thumb.boundingBox(), line.boundingBox()]);
  // the walk reaches across most of the box, with a thin margin
  expect(Math.max(drawn!.width / box!.width, drawn!.height / box!.height)).toBeGreaterThan(0.75);
  // under the two lines, as wide as most of the row and tall enough to see the route
  const [row, title] = await Promise.all([page.getByTestId(`entry-${walk.id}`).boundingBox(), page.getByTestId(`entry-${walk.id}-more`).boundingBox()]);
  expect(box!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
  expect(box!.height).toBeGreaterThanOrEqual(100);
  expect(box!.width).toBeGreaterThan(row!.width / 2);
  // the icon and the lines start where they do in a row without a map
  const food = await asHirsch().logEntry({ type: "food", foodKind: "wet", amountG: 80 });
  made.push(food.id);
  await page.reload();
  const left = async (id: number) => (await page.getByTestId(`entry-${id}-title`).boundingBox())!.x;
  expect(await left(walk.id)).toBe(await left(food.id));
});

test("an opened can shows in Verlauf and, deleted, goes back into Vorrat", async ({ page }) => {
  const client = asHirsch();
  const counted = await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 400, cans: "3" }] });
  made.push(...counted.entries.map((e) => e.id));
  const key = `opened-${Date.now()}`;
  await client.commands({ commands: [{ id: key, at: new Date(Date.parse(counted.entries[0].at) + 1000).toISOString(), kind: "can.open", unitG: 400 }] }); // after the count
  const opened = (await client.entries({ type: "opened" })).entries[0];
  made.push(opened.id);
  expect((await client.stock()).wet.sizes.find((s) => s.unitG === 400)?.cans).toBe(2);

  await signIn(page);
  await page.goto("/verlauf");
  await expect(page.getByTestId(`entry-${opened.id}-title`)).toHaveText("Dose aufgemacht");
  await expect(page.getByTestId(`entry-${opened.id}-extra`)).toHaveText("400-g-Dose");
  await page.getByTestId(`entry-${opened.id}`).click();
  await expect(page.getByTestId("fact-big")).toHaveText("400 g"); // which can, large, before deleting it
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByRole("button", { name: "Ja, löschen" }).click();
  await expect(page.getByTestId(`entry-${opened.id}`)).toHaveCount(0);
  expect((await client.stock()).wet.sizes.find((s) => s.unitG === 400)?.cans).toBe(3);
  await expectFits(page, "/mehr/vorrat", "Nassfutter");
});

test("an entry's detail shows what it is about large on top: a purchase's cans, a count's rows, a pee's time and dog", async ({ page }) => {
  const client = asHirsch();
  const dog = await firstDog();
  const bought = (await client.restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 12 }] })).entries;
  const counted = (await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 400, cans: "12" }, { unitG: 800, cans: "2" }] })).entries;
  const pee = await client.logEntry({ type: "pee", dogIds: [dog.id], at: minutesAgo(30) });
  made.push(...bought.map((e) => e.id), ...counted.map((e) => e.id), pee.id);

  await signIn(page);
  await page.goto(`${BASE_URL}/verlauf/eintrag/${bought[0].id}`);
  await expect(page.getByTestId("fact-big")).toHaveText("12 Dosen");
  await expect(page.getByTestId("fact-sub")).toHaveText("à 400 g · 4,8 kg");
  await page.goto(`${BASE_URL}/verlauf/eintrag/${counted[0].id}`);
  await expect(page.getByTestId("fact-row")).toHaveText([/^Dosen à 400 g.*12/, /^Dosen à 800 g.*2/]);
  await expect(page.getByTestId("fact-sum")).toHaveText("zusammen 6,4 kg");
  await page.goto(`${BASE_URL}/verlauf/eintrag/${pee.id}`);
  await expect(page.getByTestId("fact-big")).toHaveText(/^\d\d:\d\d$/);
  await expect(page.getByTestId("fact-sub")).toContainText(dog.name);
  // the large fact sits above the fields, and the page still fits
  const [big, field] = await Promise.all([page.getByTestId("fact-big").boundingBox(), page.getByText("Zeit", { exact: true }).boundingBox()]);
  expect(big!.y).toBeLessThan(field!.y);
  await expectFits(page, `/verlauf/eintrag/${counted[0].id}`, "Speichern");
});

test("a purchase's cans, a count's sizes and an opened can's size can be changed in their detail", async ({ page }) => {
  const client = asHirsch();
  const bought = (await client.restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 12 }, { unitG: 800, cans: 1 }] })).entries;
  const counted = (await client.correctStock({ foodKind: "wet", sizes: [{ unitG: 400, cans: "12" }, { unitG: 800, cans: "2" }] })).entries;
  const at = new Date(Date.parse(counted[0].at) + 1000).toISOString();
  await client.commands({ commands: [{ id: `open-${Date.now()}`, at, kind: "can.open", unitG: 400 }] });
  const opened = (await client.entries({ type: "opened" })).entries[0];
  made.push(...bought.map((e) => e.id), ...counted.map((e) => e.id), opened.id);
  const save = async () => {
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page).toHaveURL(/\/verlauf$/);
  };

  await signIn(page);
  await page.goto(`${BASE_URL}/verlauf/eintrag/${bought[0].id}`);
  await page.getByRole("button", { name: "1 Dose mehr" }).click();
  await expect(page.getByTestId("fact-big")).toHaveText("13 Dosen");
  await save();
  expect((await client.entry({ id: bought[0].id })).amountG).toBe(13 * 400);

  await page.goto(`${BASE_URL}/verlauf/eintrag/${counted[0].id}`);
  await page.getByRole("button", { name: "Dosen à 800 g: eins mehr" }).click();
  await page.getByRole("button", { name: "Dosen à 400 g: eins weniger" }).click();
  await expect(page.getByTestId("fact-sum")).toHaveText("zusammen 6,8 kg");
  await save();
  expect((await client.stock()).wet.sizes.filter((s) => s.unitG === 400 || s.unitG === 800).map((s) => [s.unitG, s.cans])).toEqual([[400, 10], [800, 3]]); // 11 counted, 1 opened

  await page.goto(`${BASE_URL}/verlauf/eintrag/${opened.id}`);
  await page.getByRole("button", { name: "800-g-Dose" }).click();
  await expect(page.getByTestId("fact-big")).toHaveText("800 g");
  await save();
  expect(await client.entry({ id: opened.id })).toMatchObject({ unitG: 800, amountG: 800 });
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("pulling the list down reads it again: an entry made elsewhere shows, the spinner until it has", async ({ page }) => {
    await signIn(page);
    await page.goto("/verlauf");
    await expect(page.getByTestId("screen-scroll")).toBeVisible();
    const dog = await firstDog();
    const pee = await asHirsch().logEntry({ type: "pee", dogIds: [dog.id] });
    made.push(pee.id);
    await page.waitForTimeout(500); // nothing reads by itself
    await expect(page.getByTestId(`entry-${pee.id}`)).toHaveCount(0);

    // a finger from the top of the list 200 px down, in steps, through the browser's own touch input
    const box = (await page.getByTestId("screen-scroll").boundingBox())!;
    const x = box.x + box.width / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: box.y + 20 }] });
    for (let dy = 20; dy <= 200; dy += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: box.y + 20 + dy }] });
    await expect(page.getByTestId("pull-spinner")).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(page.getByTestId(`entry-${pee.id}`)).toContainText("Pipi");
    await expect(page.getByTestId("pull-spinner")).toBeHidden();
  });
});
