import { ApiError } from "@gassi/api-client";
import { expect, test } from "vitest";
import { apiFor, errorMessage, OFFLINE } from "./api";
import { loadDevice, saveDevice } from "./device";
import { fakeServer, status } from "./testing";

test("a 401 signs the device out", async () => {
  const server = fakeServer({ "GET /api/me": () => status(401, { error: "Bitte anmelden." }) });
  saveDevice({ token: "removed", serverUrl: "" });
  await expect(apiFor(loadDevice()!, { fetch: server.fetch }).me()).rejects.toEqual(new ApiError(401, "Bitte anmelden."));
  expect(loadDevice()).toBeNull();
  expect(server.calls[0].headers.authorization).toBe("Bearer removed");
});

test("a 401 for an older token leaves a newer sign-in alone", async () => {
  const server = fakeServer({ "GET /api/me": () => status(401, { error: "Bitte anmelden." }) });
  const api = apiFor({ token: "old", serverUrl: "" }, { fetch: server.fetch });
  saveDevice({ token: "new", serverUrl: "" });
  await expect(api.me()).rejects.toThrow("Bitte anmelden.");
  expect(loadDevice()?.token).toBe("new");
});

test("a server out of reach says so in German and reports offline; any answer reports online", async () => {
  const server = fakeServer({ "GET /api/stock": () => status(400, { error: "Nein." }) });
  const reached: boolean[] = [];
  const api = apiFor({ token: "t", serverUrl: "" }, { fetch: server.fetch, onReached: (r) => reached.push(r) });
  server.reachable = false;
  const offline = await api.stock().catch((e: unknown) => e);
  expect(errorMessage(offline)).toBe(OFFLINE);
  expect(OFFLINE).toBe("Keine Verbindung – bitte später nochmal.");
  server.reachable = true;
  expect(errorMessage(await api.stock().catch((e: unknown) => e))).toBe("Nein.");
  expect(reached).toEqual([false, true]);
});
