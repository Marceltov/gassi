import { ApiError } from "@gassi/api-client";
import { expect, test, vi } from "vitest";
import { apiFor, errorMessage, isOffline, NO_ANSWER, OFFLINE } from "./api";
import { loadDevice, saveDevice } from "./device";
import { fakeServer, HIRSCH, status } from "./testing";

test("a 401 signs the device out and forgets what it showed", async () => {
  const server = fakeServer({ "GET /api/me": () => status(401, { error: "Bitte anmelden." }) });
  saveDevice({ token: "removed", serverUrl: "", person: HIRSCH });
  localStorage.setItem("gassi.snapshot", JSON.stringify({ personId: HIRSCH.id }));
  localStorage.setItem("gassi.endedWalk", JSON.stringify({ key: "w" }));
  await expect(apiFor(loadDevice()!, { fetch: server.fetch }).me()).rejects.toEqual(new ApiError(401, "Bitte anmelden."));
  expect(loadDevice()).toBeNull();
  expect(localStorage.getItem("gassi.snapshot")).toBeNull();
  expect(localStorage.getItem("gassi.endedWalk")).toBeNull();
  expect(server.calls[0].headers.authorization).toBe("Bearer removed");
});

test("a 401 for an older token leaves a newer sign-in alone", async () => {
  const server = fakeServer({ "GET /api/me": () => status(401, { error: "Bitte anmelden." }) });
  const api = apiFor({ token: "old", serverUrl: "", person: HIRSCH }, { fetch: server.fetch });
  saveDevice({ token: "new", serverUrl: "", person: HIRSCH });
  await expect(api.me()).rejects.toThrow("Bitte anmelden.");
  expect(loadDevice()?.token).toBe("new");
});

test("a server out of reach says so in German and reports offline; any answer reports online", async () => {
  const server = fakeServer({ "GET /api/stock": () => status(400, { error: "Nein." }) });
  const reached: boolean[] = [];
  const api = apiFor({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: server.fetch, onReached: (r) => reached.push(r) });
  server.reachable = false;
  const offline = await api.stock().catch((e: unknown) => e);
  expect(errorMessage(offline)).toBe(OFFLINE);
  expect(OFFLINE).toBe("Keine Verbindung – bitte später nochmal.");
  server.reachable = true;
  expect(errorMessage(await api.stock().catch((e: unknown) => e))).toBe("Nein.");
  expect(reached).toEqual([false, true]);
});

test("a call with a timeout that gets no answer in time gives up: it may have arrived, so it doesn't say OFFLINE", async () => {
  vi.useFakeTimers();
  try {
    // a fetch that never answers, only its abort ends it
    const hanging: typeof fetch = (_, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const reached: boolean[] = [];
    const call = apiFor({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: hanging, onReached: (r) => reached.push(r), timeoutMs: 3000 }).stock().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2999);
    expect(reached).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    const e = await call;
    expect(errorMessage(e)).toBe(NO_ANSWER);
    expect(NO_ANSWER).toBe("Keine Antwort – ob es gespeichert wurde, ist unklar. Bitte im Verlauf prüfen.");
    expect(isOffline(e)).toBe(false);
    expect(reached).toEqual([false]);
  } finally {
    vi.useRealTimers();
  }
});

test("a proxy's 502–504 and a failed fetch both say OFFLINE, also on a call with a timeout", async () => {
  const server = fakeServer({ "GET /api/stock": () => status(503, { error: "Service Unavailable" }) });
  const api = apiFor({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: server.fetch, timeoutMs: 3000 });
  const gateway = await api.stock().catch((e: unknown) => e);
  expect([errorMessage(gateway), isOffline(gateway)]).toEqual([OFFLINE, true]);
  server.reachable = false;
  const failed = await api.stock().catch((e: unknown) => e);
  expect([errorMessage(failed), isOffline(failed)]).toEqual([OFFLINE, true]);
});
