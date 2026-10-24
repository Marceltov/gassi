// Signing this device in with a link's token or its code: ask what the link is for (a setup or person link needs a
// name, setup also the first dog), then redeem it as this device (thisDevice.ts) and keep the device token with the
// server it came from.
import type { linkKinds } from "@gassi/api-client";
import { publicApi } from "./api";
import { saveDevice } from "./device";
import { DEVICE_KIND, thisDeviceName } from "./thisDevice";

export type LinkKey = { code: string } | { token: string };
export type LinkKind = (typeof linkKinds)[number];

/** Setup and person links make a new person: they ask for a name (setup also for the first dog). */
export const needsName = (kind: LinkKind): boolean => kind === "setup" || kind === "person";

/** A typed server address as an origin: no spaces or trailing slashes, https:// unless it says http(s). */
export function normalizeServer(typed: string): string {
  const s = typed.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export async function linkKind(server: string, key: LinkKey, fetchFn?: typeof fetch): Promise<LinkKind> {
  return (await publicApi(server, fetchFn).linkInfo(key)).kind;
}

/** Redeems the link and signs this device in; throws ApiError with the server's German message. */
export async function signIn(server: string, key: LinkKey, names: { personName?: string; dogName?: string }, fetchFn?: typeof fetch): Promise<void> {
  const blank = (s?: string) => (s?.trim() ? s.trim() : undefined);
  const { deviceToken, person } = await publicApi(server, fetchFn).redeem({ ...key, deviceKind: DEVICE_KIND, deviceName: thisDeviceName(), personName: blank(names.personName), dogName: blank(names.dogName) });
  saveDevice({ token: deviceToken, serverUrl: server, person });
}

/** What else the sign-in can offer (OIDC, mail); nothing when the server isn't reachable. */
export async function signInOptions(server: string, fetchFn?: typeof fetch): Promise<{ oidc: boolean; mail: boolean }> {
  try {
    return await publicApi(server, fetchFn).options();
  } catch {
    return { oidc: false, mail: false };
  }
}
