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
  await expect(page.getByRole("heading", { name: "Heute" })).toBeVisible();
}

export async function openMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menü" }).click();
}
