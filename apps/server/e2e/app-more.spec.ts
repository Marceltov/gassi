// Mehr: Gewicht and Vorrat (data) on top, then the settings: Hunde, Übungen und Leckerli, Haushalt (invites), Meine
// Geräte (sign out), the Garmin placeholder. And the installable web app: its manifest, the Apple tags, and the app
// shell that opens without reception after the first visit. The server is shared: each test removes what it made.
import { createClient } from "@gassi/api-client";
import { formatCanCount } from "@gassi/domain";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { asHirsch } from "./sessions";
import { signIn } from "./signed-in";

const made: number[] = [];
const invites: number[] = [];
test.afterEach(async () => {
  for (const id of made.splice(0)) await asHirsch().deleteEntry({ id }).catch(() => undefined);
  for (const id of invites.splice(0)) await asHirsch().revokeInvite({ id }).catch(() => undefined);
});

test("Mehr lists Gewicht and Vorrat first, then the settings, and the Garmin watch for later; no export", async ({ page }) => {
  await signIn(page);
  await page.goto("/mehr");
  const rows = ["Gewicht", "Vorrat", "Hunde", "Übungen und Leckerli", "Haushalt", "Meine Geräte"];
  for (const name of rows) await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByTestId("more-Garmin-Uhr")).toContainText("kommt später");
  await expect(page.getByText(/Export/)).toHaveCount(0);
  await expect(page.getByTestId("more-Haushalt")).toContainText("Hirsch");
});

test("Gewicht: 12,4 kg logged shows in the list, on the curve and on Mehr", async ({ page }) => {
  const token = await signIn(page);
  await page.goto("/mehr");
  await page.getByRole("button", { name: /^Gewicht/ }).click();
  await page.getByLabel("Gewicht in kg").fill("12,4");
  const logged = page.waitForResponse((r) => r.url().endsWith("/api/weight") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { id } = (await (await logged).json()) as { id: number };
  made.push(id);

  const client = createClient({ baseUrl: BASE_URL, token });
  expect((await client.entry({ id })).amountG).toBe(12_400);
  await expect(page.getByTestId("weight-list")).toContainText("12,4 kg");
  await expect(page.getByLabel("Gewicht in kg")).toHaveValue("");
  await expect(page.getByTestId("weight-curve")).toBeVisible();

  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByTestId("more-Gewicht")).toContainText("12,4 kg · gerade eben");
});

test("Vorrat: 6 cans of a known size bought add to that size; the total follows", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  made.push((await asHirsch().restock({ foodKind: "wet", cans: 1, unitG: 800 })).id); // 800 g is a known size
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Eingekauft" }).click();
  await page.getByRole("button", { name: "Dosen à 800 g" }).click();
  await page.getByLabel("Dosen", { exact: true }).fill("6");
  const bought = page.waitForResponse((r) => r.url().endsWith("/api/stock/restock") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { id } = (await (await bought).json()) as { id: number };
  made.push(id);
  expect(await client.entry({ id })).toMatchObject({ amountG: 6 * 800, unitG: 800 });
  const after = (await client.stock()).wet;
  const size = after.sizes.find((s) => s.unitG === 800)!;
  await expect(page.getByTestId("stock-wet")).toContainText(formatCanCount(size));
  await expect(page.getByTestId("stock-wet")).toContainText("zusammen ");
  await expect(page.getByTestId("stock-message")).toHaveText("Eingetragen.");
  // the message is about that purchase: it goes when the form turns to something else
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  await expect(page.getByTestId("stock-message")).toBeHidden();
});

test("Vorrat: a wet count sets every can size at once, a new size typed in without any purchase of it", async ({ page }) => {
  const token = await signIn(page);
  const client = createClient({ baseUrl: BASE_URL, token });
  const before = (await client.stock()).wet.sizes;
  await page.goto("/mehr/vorrat");
  await page.getByRole("tab", { name: "Nass" }).click();
  await page.getByRole("tab", { name: "Nachgezählt" }).click();
  for (const s of before) await expect(page.getByTestId(`count-${s.unitG}-value`)).toBeVisible(); // one row per known size
  await page.getByRole("button", { name: "andere Größe" }).click();
  await page.getByLabel("Gramm pro Dose").fill("1234");
  await page.getByRole("button", { name: "½ Dose à 1234 g mehr" }).click();
  await page.getByRole("button", { name: "½ Dose à 1234 g mehr" }).click();
  await page.getByRole("button", { name: "½ Dose à 1234 g mehr" }).click();
  await expect(page.getByTestId("count-1234-value")).toHaveText("1½ Dosen");
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/stock/correct") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Eintragen" }).click();
  const { entries } = (await (await counted).json()) as { entries: { id: number; unitG: number; amountG: number }[] };
  made.push(...entries.map((e) => e.id));
  expect(entries.find((e) => e.unitG === 1234)?.amountG).toBe(1851);
  expect(entries.map((e) => e.unitG).sort()).toEqual([...before.map((s) => s.unitG), 1234].sort());
  await expect(page.getByTestId("stock-wet")).toContainText("1½ × 1234 g");
  await expect(page.getByTestId("stock-message")).toHaveText("Eingetragen.");
  await page.getByRole("tab", { name: "Trocken" }).click();
  await expect(page.getByTestId("stock-message")).toBeHidden();
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
  const { id } = (await (await bought).json()) as { id: number };
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
