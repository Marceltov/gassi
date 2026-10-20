import { expect, type Page } from "@playwright/test";
import { STUB_ISSUER } from "./oidc-stub";

export const USERS = { marcel: "Hirsch", bille: "Herzii" } as const;

/** Signs in through the login page and the stub issuer as `username`. */
export async function signIn(page: Page, username: string, next = "/"): Promise<void> {
  await page.context().addCookies([{ name: "stub_user", value: username, url: STUB_ISSUER }]);
  await page.goto(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Anmelden" }).click();
}

/** Signs in as a known user and waits for the today screen. */
export async function signInAs(page: Page, username: keyof typeof USERS): Promise<void> {
  await signIn(page, username);
  await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
}

export async function openMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menü" }).click();
}

/** Signs out by dropping the cookies, then signs in as someone else. */
export async function switchUser(page: Page, username: keyof typeof USERS): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, username);
}

/** Logs an entry of the type labelled `label` with a note through the today screen's sheet. */
export async function logWithNote(page: Page, label: string, note: string): Promise<void> {
  await page.getByRole("button", { name: `Details für ${label}` }).click();
  const sheet = page.getByRole("dialog", { name: `${label} eintragen` });
  await sheet.getByLabel("Notiz").fill(note);
  await sheet.getByRole("button", { name: "Eintragen" }).click();
  await expect(sheet).toBeHidden();
}

/** The calendar day `daysAgo` days back in Berlin, as the datetime-local input wants it: "2026-10-19". */
export const berlinDay = (daysAgo = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(Date.now() - daysAgo * 86_400_000);
