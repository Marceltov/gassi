// The walk screen and its summary: one hand on the leash, the thumb taps Pipi/Poopoo, with or without reception.
import { createClient } from "@gassi/api-client";
import { expect, type Page, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch, onlyOneDog, stopEverything } from "./sessions";
import { signIn } from "./signed-in";

test.beforeEach(stopEverything);
test.afterEach(stopEverything);

const clock = (page: Page) => page.getByTestId("walk-clock");
const seconds = (text: string | null) => (text ?? "").split(":").reduce((s, part) => s * 60 + Number(part), 0);

async function startWalk(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Gassi gehen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expect(clock(page)).toHaveText(/^\d+:\d\d$/);
}

test("Pipi with one dog logs at once; without reception Poopoo and Zuhause show at once and reach the server later", async ({ page, context }) => {
  const restore = await onlyOneDog();
  try {
    const token = await signIn(page);
    const client = createClient({ baseUrl: BASE_URL, token });
    await startWalk(page);
    await expect(page.getByText(/^seit \d\d:\d\d$/)).toBeVisible();

    await page.getByRole("button", { name: "Pipi" }).click(); // one dog: no question
    const taps = page.getByTestId("walk-taps");
    await expect(taps).toContainText("Pipi");
    await expect.poll(async () => (await client.sessions()).walk !== null).toBe(true);
    const key = (await client.sessions()).walk!.key;

    await context.setOffline(true);
    await page.getByRole("button", { name: "Poopoo" }).click();
    await expect(taps).toContainText("Poopoo");
    await page.getByRole("button", { name: "Zuhause" }).click();
    await expect(page).toHaveURL(new RegExp(`/runde/${key}$`));
    await expect(page.getByTestId("summary-pees")).toContainText("1×");
    await expect(page.getByTestId("summary-poops")).toContainText("1×");
    await expect(page.getByText("Noch nicht gesendet")).toBeVisible();
    // a note typed without reception stays typed until it can be saved
    await page.getByPlaceholder("Notiz").fill("Matschig am Bach");
    await page.getByRole("button", { name: "Notiz speichern" }).click();
    await expect(page.getByText("Keine Verbindung – bitte später nochmal.")).toBeVisible();
    await expect(page.getByPlaceholder("Notiz")).toHaveValue("Matschig am Bach");

    await context.setOffline(false);
    await expect(page.getByText("Noch nicht gesendet")).toBeHidden();
    await expect(page.getByTestId("summary-pees")).toContainText("1×");
    await expect(page.getByTestId("summary-poops")).toContainText("1×");
    const walk = await client.walkByKey({ key });
    expect(walk.summary.endedAt).not.toBeNull();
    expect([walk.summary.pees.length, walk.summary.poops.length]).toEqual([1, 1]);
    await page.getByRole("button", { name: "Notiz speichern" }).click();
    await expect.poll(async () => (await client.walkByKey({ key })).summary.note).toBe("Matschig am Bach");
    await expect(page.getByRole("button", { name: "Notiz speichern" })).toBeHidden();

    // who went can be changed afterwards: Herzii went too
    await page.getByRole("button", { name: "Herzii" }).click();
    await expect.poll(async () => (await client.walkByKey({ key })).summary.walkers.map((w) => w.name).sort()).toEqual(["Herzii", "Hirsch"]);

    // with a track, the summary shows it on the map and its distance
    const t = (s: number) => new Date(Date.parse(walk.summary.startedAt) + s * 1000).toISOString();
    const points = [0, 600, 1200].map((north, i) => ({ t: t(i), lat: 48.137 + north / 111_195, lon: 11.575, ele: null, acc: 5 }));
    await client.uploadTrack({ trackId: `walk-${key}`, walkKey: key, source: "phone", seq: 0, points });
    await page.reload();
    await expect(page.getByTestId("track-map")).toContainText("OpenStreetMap");
    await expect(page.getByText("1,2 km")).toBeVisible();

    // after the reload the summary is a cold link, which resolves to Verlauf's copy and goes on to Start's: Start stays
    // highlighted and Fertig goes back to Start
    await expect(page).toHaveURL(new RegExp(`/runde/${key}$`));
    await expect(page.getByRole("tab", { name: "Start" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Fertig" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByRole("tab", { name: "Start" })).toHaveAttribute("aria-selected", "true");
  } finally {
    await restore();
  }
});

test("a reload during a walk returns to it with the clock right; Training starts on the walk and leads back", async ({ page }) => {
  await signIn(page);
  await startWalk(page);
  const before = Date.now();
  await expect.poll(async () => seconds(await clock(page).textContent())).toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
  await expect(clock(page)).toHaveText(/^\d+:\d\d$/);
  const shown = seconds(await clock(page).textContent());
  expect(shown).toBeGreaterThanOrEqual(2);
  expect(shown).toBeLessThanOrEqual(Math.ceil((Date.now() - before) / 1000) + 3);

  await page.getByRole("button", { name: "Training" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/training`);
  await expect.poll(async () => (await asHirsch().sessions()).training?.walkKey ?? null).not.toBeNull();
  await page.goBack();
  await expect(page).toHaveURL(`${BASE_URL}/runde`);
});

test("with several dogs Pipi asks for the dog, among the dogs on the walk only; walkers and dogs change by chips", async ({ page }) => {
  const client = asHirsch();
  const luna = await client.addDog({ name: "Luna", color: "#7a4fc0" });
  const emma = await client.addDog({ name: "Emma", color: "#c04f7a" });
  try {
    await signIn(page);
    await startWalk(page);
    // Emma stays at home, Herzii comes along
    await page.getByRole("button", { name: "Emma entfernen" }).click();
    await expect(page.getByRole("button", { name: "Emma entfernen" })).toBeHidden();
    // the only walker can't be tapped off: it says so
    await page.getByRole("button", { name: "Hirsch, bleibt dabei" }).click();
    await expect(page.getByText("Eine Person bleibt immer dabei.")).toBeVisible();
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await page.getByRole("button", { name: "Herzii", exact: true }).click();
    await expect(page.getByRole("button", { name: "Herzii entfernen" })).toBeVisible();

    await page.getByRole("button", { name: "Pipi" }).click();
    const choice = page.getByTestId("dog-choice");
    await expect(choice.getByRole("button", { name: "Luna" })).toBeVisible();
    await expect(choice.getByRole("button", { name: "Toffee" })).toBeVisible();
    await expect(choice.getByRole("button", { name: "Emma" })).toHaveCount(0);
    await choice.getByRole("button", { name: "Luna" }).click();
    await expect(page.getByTestId("walk-taps")).toContainText("Pipi · Luna");

    await expect.poll(async () => (await client.sessions()).walk?.walkers.map((w) => w.name).sort()).toEqual(["Herzii", "Hirsch"]);
    const walk = (await client.sessions()).walk!;
    expect(walk.dogIds).toContain(luna.id);
    expect(walk.dogIds).not.toContain(emma.id);
    await expect.poll(async () => (await client.walkByKey({ key: walk.key })).summary.pees).toEqual([expect.objectContaining({ dogId: luna.id })]);
  } finally {
    for (const d of [luna, emma]) await client.updateDog({ id: d.id, archived: true });
  }
});

test("the other phone ends the walk: this one goes back to Start, and a pause queued after the end is dropped quietly", async ({ page, context }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await signIn(page);
  await startWalk(page);
  const other = asHirsch();
  await expect.poll(async () => (await other.sessions()).walk !== null).toBe(true);

  await context.setOffline(true);
  const { walk } = await other.sessions();
  await other.commands({ commands: [{ id: `other-stop-${Date.now()}`, at: new Date().toISOString(), kind: "walk.stop", walkKey: walk!.key }] });
  await page.getByRole("button", { name: "Pause" }).click(); // after the end, without reception
  await expect(page.getByRole("button", { name: "Weiter" })).toBeVisible();

  await context.setOffline(false); // reception back: the queue goes out and the walk is over
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByRole("button", { name: "Gassi gehen" })).toBeVisible();
  expect(dialogs).toEqual([]);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("gassi.commands.")).map((k) => JSON.parse(localStorage.getItem(k)!).length))).toEqual([0]);
});
