// The typed client as the app uses it. Every call through it tells whether it reached the server (for `online`),
// turns "no reception" into the German message the screens show, and a 401 signs this device out (the device was
// removed or its token is gone) and forgets what it showed, which brings up the sign-in.
import { ApiError, type Client, createClient } from "@gassi/api-client";
import { clearDevice, type Device, loadDevice } from "./device";
import { clearEnded } from "../walk/ended";
import { clearSnapshot } from "./snapshot";

/** The server: empty on the web, where the server serves the app (same origin); set for development. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** What a write that needs the server says when it isn't reachable. */
export const OFFLINE = "Keine Verbindung – bitte später nochmal.";

/** What a write says that got no answer in time: it may have reached the server, so trying again could save it twice. */
export const NO_ANSWER = "Keine Antwort – ob es gespeichert wurde, ist unklar. Bitte im Verlauf prüfen.";
/** The status of the ApiError for NO_ANSWER (OFFLINE's is 0). */
export const NO_ANSWER_STATUS = -1;

/** How long a write that needs the server waits for its answer before it says NO_ANSWER (one bar, a captive network). */
export const WRITE_TIMEOUT_MS = 10_000;

/** `timeoutMs`: give up on a call that has no answer by then (NO_ANSWER; it counts as unreachable for `online`). */
type Options = { fetch?: typeof fetch; onReached?: (reached: boolean) => void; timeoutMs?: number };

// A proxy in front of a stopped server answers 502–504: as unreachable as no reception.
const unreachable = (status: number) => status >= 502 && status <= 504;

function wrap(fetchFn: typeof fetch, onReached: (reached: boolean) => void, onAnswer: (res: Response) => void, timeoutMs?: number): typeof fetch {
  return async (input, init) => {
    let res: Response;
    // a timer and an AbortController rather than AbortSignal.timeout, which not every runtime has
    const abort = timeoutMs ? new AbortController() : null;
    const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : null;
    try {
      res = await fetchFn(input, abort ? { ...init, signal: abort.signal } : init);
    } catch {
      onReached(false);
      // given up on, it may have arrived all the same; a fetch that failed by itself never left
      throw abort?.signal.aborted ? new ApiError(NO_ANSWER_STATUS, NO_ANSWER) : new ApiError(0, OFFLINE);
    } finally {
      if (timer) clearTimeout(timer);
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
export function apiFor(device: Device, { fetch: fetchFn = (...a) => fetch(...a), onReached = () => {}, timeoutMs }: Options = {}): Client {
  const signOutOn401 = (res: Response) => {
    // only if this device is still the signed-in one: another tab may have signed in anew meanwhile
    if (res.status === 401 && loadDevice()?.token === device.token) forgetDevice();
  };
  return createClient({ baseUrl: device.serverUrl, token: device.token, fetch: wrap(fetchFn, onReached, signOutOn401, timeoutMs) });
}

/** Signs this device out here: forgets the token and what it showed, which brings up the sign-in. The queue of unsent
 * taps stays (per person): it goes out when the same person signs in again. */
export function forgetDevice(): void {
  clearSnapshot();
  clearEnded();
  clearDevice();
}

/** The client before sign-in (links and codes). */
export function publicApi(fetchFn: typeof fetch = (...a) => fetch(...a)): Client {
  return createClient({ baseUrl: API_URL, fetch: wrap(fetchFn, () => {}, () => {}) });
}

/** What to show for a failed call: the server's message, OFFLINE when it wasn't reachable, NO_ANSWER when it got no
 * answer in time. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Das hat nicht geklappt.";
}

/** Whether `e` means the server wasn't reachable. */
export const isOffline = (e: unknown): boolean => e instanceof ApiError && e.status === 0;
