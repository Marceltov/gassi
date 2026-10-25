// What this device is to the server: the kind and name it signs in with, and which server a sign-in link points it to.
// The Android app signs in as a phone named after its model, and takes the server from the link (one app serves any
// household); the web app takes them from the browser and its own origin (thisDevice.web.ts).
import { modelName } from "expo-device";
import { normalizeServer } from "./signin";

export const DEVICE_KIND: "phone" | "web" = "phone";

/** "Galaxy S21 Ultra (App)" and the like, for the household's list of devices. */
export function thisDeviceName(): string {
  return `${modelName ?? "Android"} (App)`;
}

/** The platform the app's events name (events.ts). */
export const platformName = (): string => "android";

/** The server a link (gassi://join?server=…) names, or null when it names none. */
export function linkedServer(param: string | undefined): string | null {
  return param?.trim() ? normalizeServer(param) : null;
}
