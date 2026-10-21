// The typed client as the app uses it. Every call through it tells whether it reached the server (for `online`),
// turns "no reception" into the German message the screens show, and a 401 signs this device out (the device was
// removed or its token is gone), which brings up the sign-in.
import { ApiError, type Client, createClient } from "@gassi/api-client";
import { clearDevice, type Device, loadDevice } from "./device";

/** The server: empty on the web, where the server serves the app (same origin); set for development. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** What a write that needs the server says when it isn't reachable. */
export const OFFLINE = "Keine Verbindung – bitte später nochmal.";

type Options = { fetch?: typeof fetch; onReached?: (reached: boolean) => void };

// A proxy in front of a stopped server answers 502–504: as unreachable as no reception.
const unreachable = (status: number) => status >= 502 && status <= 504;

function wrap(fetchFn: typeof fetch, onReached: (reached: boolean) => void, onAnswer: (res: Response) => void): typeof fetch {
  return async (input, init) => {
    let res: Response;
    try {
      res = await fetchFn(input, init);
    } catch {
      onReached(false);
      throw new ApiError(0, OFFLINE);
    }
    if (unreachable(res.status)) {
      onReached(false);
      throw new ApiError(0, OFFLINE);
    }
    onReached(true);
    onAnswer(res);
    return res;
  };
}

/** The client for a signed-in device. */
export function apiFor(device: Device, { fetch: fetchFn = (...a) => fetch(...a), onReached = () => {} }: Options = {}): Client {
  const signOutOn401 = (res: Response) => {
    // only if this device is still the signed-in one: another tab may have signed in anew meanwhile
    if (res.status === 401 && loadDevice()?.token === device.token) clearDevice();
  };
  return createClient({ baseUrl: device.serverUrl, token: device.token, fetch: wrap(fetchFn, onReached, signOutOn401) });
}

/** The client before sign-in (links and codes). */
export function publicApi(fetchFn: typeof fetch = (...a) => fetch(...a)): Client {
  return createClient({ baseUrl: API_URL, fetch: wrap(fetchFn, () => {}, () => {}) });
}

/** What to show for a failed call: the server's message, or OFFLINE when it wasn't reachable. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Das hat nicht geklappt.";
}

/** Whether `e` means the server wasn't reachable. */
export const isOffline = (e: unknown): boolean => e instanceof ApiError && e.status === 0;
