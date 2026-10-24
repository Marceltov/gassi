// The web app signs in as "web", named after the browser's system, and always talks to the server that serves it.
// Same interface as thisDevice.ts ("./thisDevice" means this file on the web, so that one is named with its extension).
import type * as Native from "./thisDevice.ts";
import { API_URL } from "./api";

export const DEVICE_KIND: typeof Native.DEVICE_KIND = "web";

/** "iPhone (Web)" and the like, from the browser's user agent. */
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

export function thisDeviceName(): string {
  return deviceName(typeof navigator === "undefined" ? "" : navigator.userAgent);
}

/** The server that serves this page; a link's `server` is ignored (it is this one anyway). */
export function linkedServer(_param: string | undefined): string | null {
  return API_URL;
}

const sameAsNative: Omit<typeof Native, "DEVICE_KIND"> = { thisDeviceName, linkedServer };
void sameAsNative;
