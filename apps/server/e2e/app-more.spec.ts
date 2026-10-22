// Mehr: Gewicht and Vorrat (data) on top, then the settings: Hunde, Übungen, Leckerli, Haushalt (invites), Meine
// Geräte (sign out), the Garmin placeholder. And the installable web app: its manifest, the Apple tags, and the app
// shell that opens without reception after the first visit. The server is shared: each test removes what it made.
import { createClient } from "@gassi/api-client";
import { formatCanCount, localToUtc, utcToLocal } from "@gassi/domain";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch } from "./sessions";
import { signIn } from "./signed-in";

/** Today in Berlin, where the page runs: "2026-10-22". */
const today = () => utcToLocal(Date.now(), "Europe/Berlin").slice(0, 10);

const made: number[] = [];
/** Taps a value that reads as text (it turns into a field) and types `text` into it. */
const typeIn = async (value: Locator, text: string) => {
  await value.click();
  await value.fill(text);
};
/** A number of cans as the count field shows it ("2,75"). */
const decimal = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });
const invites: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
  for (const id of invites.splice(0)) await asHirsch().revokeInvite({ id }).catch(() => undefined);
});

test("Mehr lists Gewicht and Vorrat first, then the settings, and the Garmin watch for later, the source code, Abmelden last; no export", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr");
  const rows = ["Gewicht", "Vorrat", "Hunde", "Übungen", "Leckerli", "Haushalt", "Meine Geräte", "Quellcode", "Abmelden"];
  for (const name of rows) await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByTestId("more-Garmin-Uhr")).toContainText("kommt später");
  await expect(page.getByText(/Export/)).toHaveCount(0);
  await expect(page.getByTestId("more-Haushalt")).toContainText("Hirsch");
});

test("Gewicht: 12,4 kg today shows on top, on today in the calendar, on the curve and on Mehr", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/mehr");
  await page.getByRole("button", { name: /^Gewicht/ }).click();
  await page.getByLabel("Gewicht heute in kg").fill("12,4");
  const logged = page.waitForResponse((r) => r.url().endsWith("/api/weight") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen", exact: true }).click();
  const { id } = (await (await logged).json()) as { id: number };
  made.push(id);

  expect((await createClient({ baseUrl: BASE_URL, token }).entry({ id })).amountG).toBe(12_400);
  await expect(page.getByTestId("weight-now")).toContainText("12,4 kg");
  await expect(page.getByTestId(`day-${today()}`)).toContainText("12,4");
  await expect(page.getByLabel("Gewicht heute in kg")).toHaveValue("");
  await expect(page.getByTestId("weight-curve")).toBeVisible();

  await page.getByRole("tab", { name: "Mehr" }).click();
  await expect(page.getByTestId("more-Gewicht")).toContainText("12,4 kg · gerade eben");
});

test("Gewicht: a day last month is added, changed and deleted from the calendar; › stops at this month", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  await page.goto("/mehr/gewicht");
  const month = page.getByTestId("weight-month");
  const thisMonth = await month.textContent();
  await expect(page.getByRole("button", { name: "Monat danach" })).toBeDisabled();
  await page.getByRole("button", { name: "Monat davor" }).click();
  await expect(month).not.toHaveText(thisMonth!);
  const [y, m] = today().split("-").map(Number);
  const day = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-15`;

  // an empty day: the weight goes in at its noon
  await page.getByTestId(`day-${day}`).click();
  const sheet = page.getByTestId("weight-day-sheet");
  await expect(sheet).toContainText("noch kein Gewicht an diesem Tag");
  await sheet.getByLabel("Gewicht in kg").fill("11,9");
  const logged = page.waitForResponse((r) => r.url().endsWith("/api/weight") && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  const { id } = (await (await logged).json()) as { id: number };
  made.push(id);
  expect((await client.entry({ id })).at).toBe(new Date(localToUtc(`${day}T12:00`, "Europe/Berlin")).toISOString());
  await expect(page.getByTestId(`day-${day}`)).toContainText("11,9");

  // a day with a weight: changed, then deleted
  await page.getByTestId(`day-${day}`).click();
  await expect(sheet.getByLabel("Gewicht in kg")).toHaveValue("11,9");
  await sheet.getByLabel("Gewicht in kg").fill("12,1");
  await sheet.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByTestId(`day-${day}`)).toContainText("12,1");
  expect((await client.entry({ id })).amountG).toBe(12_100);
  await page.getByTestId(`day-${day}`).click();
  await sheet.getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByTestId(`day-${day}`)).not.toContainText("12,1");
  await expect(client.entry({ id })).rejects.toMatchObject({ status: 404 });

  await page.getByRole("button", { name: "Monat danach" }).click();
  await expect(month).toHaveText(thisMonth!);
});

test("Vorrat: cans bought are entered per size in rows, a new size in a row of its own; one Eintragen records each", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 800, cans: 1 }] })).entries.map((e) => e.id)); // 800 g is a known size
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await expect(page.getByTestId("count-800-value")).toHaveText("0 Dosen"); // bought: from 0
  await page.getByRole("button", { name: "1 Dose à 800 g mehr" }).click();
  await page.getByRole("button", { name: "1 Dose à 800 g mehr" }).click();
  await page.getByRole("button", { name: "Dosengröße hinzufügen" }).click();
  await page.getByTestId("count-new").getByLabel("Dosengröße in Gramm").fill("1234");
  await page.getByRole("button", { name: "1 Dose à 1234 g mehr" }).click();
  // a row without grams holds up Eintragen until it is taken away with ×
  await page.getByRole("button", { name: "Dosengröße hinzufügen" }).click();
  await page.getByRole("button", { name: "1 Dose neuer Größe mehr" }).click();
  await expect(page.getByTestId("stock-unsized")).toHaveText("Eine Zeile hat keine Dosengröße: Gramm eintragen oder mit × entfernen.");
  await expect(page.getByRole("button", { name: "Eintragen" })).toBeDisabled();
  await page.getByTestId("count-new").getByRole("button", { name: "Dosengröße entfernen" }).click();
  await expect(page.getByTestId("stock-unsized")).toHaveCount(0);
  await expect(page.getByTestId("count-1234-value")).toHaveText("1 Dose");
  const bought = page.waitForResponse((r) => r.url().endsWith("/api/stock/restock") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await bought).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.map((e) => [e.unitG, e.amountG]).sort()).toEqual([[1234, 1234], [800, 1600]].sort()); // sizes left at 0 stay out
  const after = (await client.stock()).wet;
  await expect(page.getByTestId("stock-wet")).toContainText(formatCanCount(after.sizes.find((s) => s.unitG === 800)!));
  await expect(page.getByTestId("stock-wet")).toContainText("zusammen ");
  await expect(page.getByTestId("stock-message")).toHaveText("Eingetragen.");
  // the message is about that purchase: it goes when the form turns to something else
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await expect(page.getByTestId("stock-message")).toBeHidden();
});

test("Vorrat: a wet count sets every can size at once, typed freely or by whole cans, a new size without any purchase of it", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 3 }] })).entries.map((e) => e.id));
  const before = (await client.stock()).wet.sizes;
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  for (const s of before) await expect(page.getByTestId(`count-${s.unitG}-value`)).toHaveText(decimal(s.cans)); // one row per known size, from the stock
  await typeIn(page.getByLabel("Anzahl Dosen à 400 g"), "zwei");
  await page.getByRole("button", { name: "Eintragen" }).click();
  await expect(page.getByTestId("stock-message")).toHaveText("Wie viele Dosen sind noch da? Eine Zahl, z. B. 2,75.");
  await typeIn(page.getByLabel("Anzahl Dosen à 400 g"), "2,75");
  await page.getByRole("button", { name: "Dosengröße hinzufügen" }).click();
  await page.getByTestId("count-new").getByLabel("Dosengröße in Gramm").fill("1235");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "½ Dose à 1235 g mehr" }).click();
  await expect(page.getByTestId("count-1235-value")).toHaveText("1,5");
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.find((e) => e.unitG === 400)?.amountG).toBe(1100);
  expect(entries.find((e) => e.unitG === 1235)?.amountG).toBe(1853);
  expect(entries.map((e) => e.unitG).sort()).toEqual([...before.map((s) => s.unitG), 1235].sort());
  await expect(page.getByTestId("stock-wet")).toContainText("2¾ × 400 g");
  await expect(page.getByTestId("stock-wet")).toContainText("1½ × 1235 g");
  await expect(page.getByTestId("stock-message")).toHaveText("Eingetragen.");
  await page.getByRole("tab", { name: "Trocken" }).click();
  await expect(page.getByTestId("stock-message")).toBeHidden();
});

test("Vorrat: a new row typed with a known size adds only what is typed to it, also when counting", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 400, cans: 2 }] })).entries.map((e) => e.id));
  const before = (await client.stock()).wet.sizes;
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await page.getByRole("button", { name: "Dosengröße hinzufügen" }).click();
  await page.getByTestId("count-new").getByLabel("Dosengröße in Gramm").fill("400");
  await expect(page.getByTestId("count-400-value")).toHaveCount(2);
  await expect(page.getByTestId("count-400-value").last()).toHaveText("0"); // only the known row starts at the stock
  await page.getByRole("button", { name: "½ Dose à 400 g mehr" }).last().click();
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  const was = before.find((s) => s.unitG === 400)!.cans;
  expect(entries.find((e) => e.unitG === 400)?.amountG).toBe(Math.round((was + 0.5) * 400));
});

test("Vorrat: × while buying only hides the size from the purchase rows; the stock keeps it, and buying it again brings it back", async ({ page }) => {
  await signIn(page);
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 9999, cans: 1 }] })).entries.map((e) => e.id));
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await page.getByRole("button", { name: "Dosengröße hinzufügen" }).click();
  await page.getByTestId("count-new").getByRole("button", { name: "Dosengröße entfernen" }).click(); // an added row: just gone
  await expect(page.getByTestId("count-new")).toHaveCount(0);
  await page.getByTestId("count-9999").getByRole("button", { name: "Dosengröße entfernen" }).click();
  await expect(page.getByTestId("count-9999")).toHaveCount(0);
  await expect(page.getByTestId("stock-wet")).toContainText("1 × 9999 g"); // the stock didn't change

  await page.reload(); // remembered on this phone
  await page.getByRole("tab", { name: "Nass" }).click();
  await expect(page.getByTestId("stock-wet")).toContainText("1 × 9999 g");
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await expect(page.getByTestId("count-9999")).toHaveCount(0);
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await expect(page.getByTestId("count-9999")).toBeVisible(); // counting still lists it

  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 9999, cans: 1 }] })).entries.map((e) => e.id)); // bought again
  await page.reload();
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await expect(page.getByTestId("count-9999")).toBeVisible();
});

test("Vorrat: × while counting sets the size to 0; Eintragen retires it", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 9998, cans: 1 }] })).entries.map((e) => e.id));
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await page.getByTestId("count-9998").getByRole("button", { name: "Dosengröße entfernen" }).click();
  await expect(page.getByTestId("count-9998")).toHaveCount(0);
  await expect(page.getByTestId("stock-wet")).toContainText("1 × 9998 g"); // not before Eintragen
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.find((e) => e.unitG === 9998)?.amountG).toBe(0);
  expect((await client.stock()).wet.sizes.some((x) => x.unitG === 9998)).toBe(false);

  await page.reload();
  await page.getByRole("tab", { name: "Nass" }).click();
  await expect(page.getByTestId("stock-wet")).not.toContainText("…"); // the stock is in
  await expect(page.getByTestId("stock-wet")).not.toContainText("9998");
  for (const mode of ["Eingekauft", "Nachgezählt"]) {
    await page.getByRole("tab", { name: mode }).click();
    await expect(page.getByTestId("count-9998")).toHaveCount(0);
  }
});

test("Vorrat: every size can be corrected; counting, 10000 g corrected to 1000 g retires 10000 g", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 10_000, cans: 2 }] })).entries.map((e) => e.id)); // meant 1000 g
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  const row = page.getByTestId("count-10000");
  await expect(row.getByLabel("Dosengröße in Gramm")).toHaveText("10000"); // plain text until tapped
  await typeIn(row.getByLabel("Dosengröße in Gramm"), "1000");
  await page.keyboard.press("Enter");
  await expect(row.getByLabel("Dosengröße in Gramm")).toHaveText("1000");
  await expect(row.getByLabel("Anzahl Dosen à 1000 g")).toHaveText("2");
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.find((e) => e.unitG === 1000)?.amountG).toBe(2000);
  expect(entries.find((e) => e.unitG === 10_000)?.amountG).toBe(0);
  await expect(page.getByTestId("stock-wet")).toContainText("2 × 1000 g");
  await expect(page.getByTestId("stock-wet")).not.toContainText("10000");
  expect((await client.stock()).wet.sizes.some((x) => x.unitG === 10_000)).toBe(false);
});

test("Vorrat: dry food bought in kg with a decimal comma, counted in g", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Trocken" }).click();
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await page.getByRole("tab", { name: "kg", exact: true }).click();
  await page.getByLabel("Menge").fill("1,5");
  const bought = page.waitForResponse((r) => r.url().endsWith("/api/stock/restock") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries: [{ id }] } = (await (await bought).json()) as { entries: { id: number }[] };
  made.push(id);
  expect(await client.entry({ id })).toMatchObject({ foodKind: "dry", amountG: 1500 });
  await expect(page.getByTestId("stock-message")).toHaveText("Eingetragen.");

  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await page.getByRole("tab", { name: "g", exact: true }).click();
  await page.getByLabel("Menge").fill("750");
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.map((e) => e.amountG)).toEqual([750]);
  await expect(page.getByTestId("stock-dry")).toContainText("750 g");
});

test("Haushalt: an invite shows its link, its code and when it ends; Zurückziehen takes it back", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr/haushalt");
  await expect(page.getByTestId("members")).toContainText("Hirsch");
  const created = page.waitForResponse((r) => r.url().endsWith("/api/invites") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Person einladen" }).click();
  const { id } = (await (await created).json()) as { id: number };
  invites.push(id);

  const card = page.getByTestId("invite");
  await expect(card.getByTestId("invite-code")).toHaveText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  await expect(card.getByTestId("invite-link")).toContainText(`${BASE_URL}/l/`);
  await expect(card).toContainText("gilt bis");
  const code = await card.getByTestId("invite-code").innerText();
  expect((await createClient({ baseUrl: BASE_URL }).linkInfo({ code })).kind).toBe("person");

  await card.getByRole("button", { name: "Zurückziehen" }).click();
  await expect(card).toBeHidden();
  await expect.poll(async () => (await asHirsch().invites()).invites.some((i) => i.id === id)).toBe(false);
});

test("Meine Geräte: Abmelden on this device removes it on the server and lands on /anmelden", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/mehr/geraete");
  await expect(page.getByTestId("device-current")).toContainText("Playwright (Web)");
  await page.getByRole("button", { name: "Auf diesem Gerät abmelden" }).click();
  await page.getByRole("button", { name: "Ja, abmelden" }).click();

  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gassi.device"))).toBeNull();
  await expect(createClient({ baseUrl: BASE_URL, token }).me()).rejects.toMatchObject({ status: 401 });
});

test("Abmelden, the last row in Mehr, asks and then signs this device out", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/mehr");
  await expect(page.getByTestId("more-Abmelden")).toContainText("auf diesem Gerät");
  await page.getByTestId("more-Abmelden").click();
  await page.getByTestId("signout-sheet").getByRole("button", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/mehr`);
  await page.getByTestId("more-Abmelden").click();
  await page.getByRole("button", { name: "Ja, abmelden" }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(createClient({ baseUrl: BASE_URL, token }).me()).rejects.toMatchObject({ status: 401 });
});

test("Abmelden here doesn't wait for a server that doesn't answer: after a few seconds this browser signs out anyway", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/mehr/geraete");
  await expect(page.getByTestId("device-current")).toBeVisible();
  await context.route((url) => /^\/api\/devices\/\d+$/.test(url.pathname), () => {}); // the removal never answers
  try {
    await page.getByRole("button", { name: "Auf diesem Gerät abmelden" }).click();
    await page.getByRole("button", { name: "Ja, abmelden" }).click();
    await expect(page).toHaveURL(/\/anmelden$/, { timeout: 6000 });
    expect(await page.evaluate(() => localStorage.getItem("gassi.device"))).toBeNull();
  } finally {
    await context.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("the manifest is served with Gassi's name, dark colors and icons; the page links it with the Apple tags", async ({ request }) => {
  const res = await request.get("/manifest.json");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Gassi", short_name: "Gassi", display: "standalone", start_url: "/", lang: "de", theme_color: "#111418", background_color: "#111418" });
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);

  const html = await (await request.get("/")).text();
  for (const tag of ['rel="manifest" href="/manifest.json"', 'name="apple-mobile-web-app-capable" content="yes"', 'name="apple-mobile-web-app-status-bar-style"', 'rel="apple-touch-icon" href="/apple-icon.png"', 'name="theme-color"']) {
    expect(html).toContain(tag);
  }
});

// Signed in, the app visited once, and the service worker in control with the shell kept.
async function installed(page: Page) {
  await signIn(page);
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Start" })).toBeVisible();
  await page.evaluate(async () => {
    // listening first, so a controller arriving between the check and the listener isn't missed
    const controlled = new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await controlled;
  });
}

// app pages and the shell, not the API, the bundles or files
const appPage = (url: URL) => !/^\/(api|_expo|assets)\//.test(url.pathname) && !/\.[^/]*$/.test(url.pathname);

test("after the first visit the app opens without reception; the API is never cached", async ({ page, context }) => {
  await installed(page);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("tab", { name: "Start" })).toBeVisible();
    await page.goto("/woche"); // a deep link, too
    await expect(page.getByRole("tab", { name: "Woche" })).toHaveAttribute("aria-selected", "true");
  } finally {
    await context.setOffline(false);
  }
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url)))).flat());
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
});

test("the installed app opens at once when the network hangs (one bar, a captive network)", async ({ page, context }: { page: Page; context: BrowserContext }) => {
  await installed(page);
  // every app page and the shell's refresh get no answer, ever
  await context.route(appPage, () => {});
  try {
    await page.reload({ timeout: 5000 });
    await expect(page.getByRole("tab", { name: "Start" })).toBeVisible({ timeout: 3000 });
    await page.goto("/mehr", { timeout: 5000 });
    await expect(page.getByRole("tab", { name: "Mehr" })).toHaveAttribute("aria-selected", "true", { timeout: 3000 });
  } finally {
    await context.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("a sheet that opens with its field focused closes with Escape from that field and gives the focus back to the button that opened it", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr/hunde");
  const add = page.getByRole("button", { name: "Hund hinzufügen" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("sheet-overlay").getByLabel("Name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("sheet-overlay")).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("Vorrat: quick + taps each count; a count reads out with its value; clearing a size's grams holds up Eintragen", async ({ page }) => {
  await signIn(page);
  made.push(...(await asHirsch().restock({ foodKind: "wet", sizes: [{ unitG: 777, cans: 1 }] })).entries.map((e) => e.id));
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  const row = page.getByTestId("count-777");
  await expect(row.getByLabel("Anzahl Dosen à 777 g")).toHaveAccessibleName("Anzahl Dosen à 777 g, 1");
  // four taps faster than the screen renders
  await row.getByRole("button", { name: "½ Dose à 777 g mehr" }).evaluate((b: HTMLElement) => {
    for (let i = 0; i < 4; i++) b.click();
  });
  await expect(row.getByLabel("Anzahl Dosen à 777 g")).toHaveText("3");

  await typeIn(row.getByLabel("Dosengröße in Gramm"), "");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("stock-unsized")).toHaveText("Eine Zeile hat keine Dosengröße: Gramm eintragen oder mit × entfernen.");
  await expect(page.getByRole("button", { name: "Eintragen" })).toBeDisabled();
});
