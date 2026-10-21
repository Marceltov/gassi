// Signing this browser in with a link's token or its code: ask what the link is for (a setup or person link needs a
// name, setup also the first dog), then redeem it as a "web" device and keep the device token.
import type { linkKinds } from "@gassi/api-client";
import { API_URL, publicApi } from "./api";
import { saveDevice } from "./device";

export type LinkKey = { code: string } | { token: string };
export type LinkKind = (typeof linkKinds)[number];

/** Setup and person links make a new person: they ask for a name (setup also for the first dog). */
export const needsName = (kind: LinkKind): boolean => kind === "setup" || kind === "person";

export async function linkKind(key: LinkKey, fetchFn?: typeof fetch): Promise<LinkKind> {
  return (await publicApi(fetchFn).linkInfo(key)).kind;
}

/** Redeems the link and signs this browser in; throws ApiError with the server's German message. */
export async function signIn(key: LinkKey, names: { personName?: string; dogName?: string }, userAgent: string, fetchFn?: typeof fetch): Promise<void> {
  const blank = (s?: string) => (s?.trim() ? s.trim() : undefined);
  const { deviceToken } = await publicApi(fetchFn).redeem({ ...key, deviceKind: "web", deviceName: deviceName(userAgent), personName: blank(names.personName), dogName: blank(names.dogName) });
  saveDevice({ token: deviceToken, serverUrl: API_URL });
}

/** "iPhone (Web)" and the like, for the household's list of devices. */
export function deviceName(userAgent: string): string {
  const kinds: [RegExp, string][] = [
    [/iPhone/, "iPhone"],
    [/iPad/, "iPad"],
    [/Android/, "Android"],
    [/Macintosh|Mac OS X/, "Mac"],
    [/Windows/, "Windows"],
    [/Linux|X11/, "Linux"],
  ];
  return `${kinds.find(([re]) => re.test(userAgent))?.[1] ?? "Browser"} (Web)`;
}

/** Whether the household signs in through OIDC: /api/oidc/start exists only then (404 otherwise; 400 without a target). */
export async function oidcAvailable(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<boolean> {
  try {
    return (await fetchFn(`${API_URL}/api/oidc/start`, { redirect: "manual" })).status === 400;
  } catch {
    return false;
  }
}

/** Where "Mit authentik anmelden" goes; the sign-in ends at /join?token=… (or /join?error=signin). */
export const OIDC_START = `${API_URL}/api/oidc/start?web=1`;
