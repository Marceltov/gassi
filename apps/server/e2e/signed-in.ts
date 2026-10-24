// For browser specs that start signed in: a new web device for Hirsch (from api.spec.ts's token), put into the page's
// localStorage before the app loads, as the sign-in would.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import type { Page } from "@playwright/test";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

export async function signIn(page: Page, deviceName = "Playwright (Web)"): Promise<string> {
  const invite = await createClient({ baseUrl: BASE_URL, token: readFileSync(TOKEN_FILE, "utf8").trim() }).createInvite({ kind: "device" });
  const { deviceToken, person } = await createClient({ baseUrl: BASE_URL }).redeem({ code: invite.code, deviceKind: "web", deviceName });
  await page.addInitScript((device) => localStorage.setItem("gassi.device", JSON.stringify(device)), { token: deviceToken, serverUrl: "", person });
  return deviceToken;
}
