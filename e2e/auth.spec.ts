import { expect, test } from "@playwright/test";
import { openMenu, signIn, signInAs } from "./helpers";

test("signed out, a page sends you to the login page and back after signing in", async ({ page }) => {
  await page.goto("/verlauf");
  await expect(page).toHaveURL(/\/login\?next=%2Fverlauf$/);
  await page.getByRole("link", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/verlauf$/);
});

test("sign in as marcel, see Hirsch, log out", async ({ page }) => {
  await signInAs(page, "marcel");
  await openMenu(page);
  await expect(page.getByText("Angemeldet als Hirsch")).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("someone not in USERS sees the 403 page", async ({ page }) => {
  await signIn(page, "mallory");
  await expect(page.getByRole("heading", { name: "Kein Zugang" })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
