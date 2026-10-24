import type { Command } from "@gassi/domain";
import { expect, test } from "vitest";
import { forgetDevice } from "./api";
import { saveDevice } from "./device";
import { loadKept } from "./kept";
import { createGassiStore } from "./store";
import { HIRSCH, household, status } from "./testing";

const start = (id: string): Command => ({ id, at: new Date().toISOString(), kind: "walk.start", walkKey: "w1" });
const settle = () => new Promise((r) => setTimeout(r, 0));

test("loads the household and the running sessions", async () => {
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: household().fetch });
  expect(store.get().me).toEqual(HIRSCH); // kept with the device: known before the first answer
  await store.refresh();
  expect(store.get()).toMatchObject({ me: { name: "Hirsch" }, people: [{ name: "Hirsch" }, { name: "Herzii" }], dogs: [{ name: "Toffee" }], exercises: [{ name: "Sitz" }], online: true, view: { walk: null } });
});

test("a tap without reception stays queued, shows at once, and goes out once the server is back", async () => {
  const server = household();
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: server.fetch });
  await store.refresh();
  server.reachable = false;
  store.send(start("s1"));
  await settle();
  const offline = store.get();
  expect(offline.online).toBe(false);
  expect(offline.unsent).toBe(1);
  // the projection shows the walk with Toffee (the active dog) and Hirsch
  expect(offline.view.walk).toMatchObject({ key: "w1", dogIds: [1], walkers: [{ name: "Hirsch" }] });
  expect(JSON.parse(localStorage.getItem("gassi.commands.p-hirsch")!)).toMatchObject([{ id: "s1" }]);

  server.reachable = true;
  server.handlers["POST /api/commands"] = () => ({ applied: ["s1"], dropped: [], view: { walk: { key: "w1", startedAt: "2026-10-21T10:00:00.000Z", dogIds: [1], walkers: [{ id: "p-hirsch", name: "Hirsch" }], pauses: [], paused: false, recorder: null }, training: null } });
  server.handlers["GET /api/sessions"] = server.handlers["POST /api/commands"] as never;
  await store.refresh();
  expect(store.get()).toMatchObject({ online: true, unsent: 0, view: { walk: { key: "w1", startedAt: "2026-10-21T10:00:00.000Z" } } });
});

test("subscribers hear about each change", async () => {
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: household().fetch });
  let changes = 0;
  const stop = store.subscribe(() => changes++);
  await store.refresh();
  stop();
  expect(changes).toBeGreaterThan(0);
});

test("reopened without reception: the queued walk shows at once, with the household as last seen, and a new tap is kept", async () => {
  const device = { token: "t", serverUrl: "", person: HIRSCH };
  saveDevice(device);
  const first = household();
  const before = createGassiStore(device, { fetch: first.fetch });
  await before.refresh(); // the last answer is kept: Toffee, Herzii
  first.reachable = false;
  before.send(start("s1"));
  await settle();

  // the app is closed and opened again, still without reception
  const offline = household();
  offline.reachable = false;
  const store = createGassiStore(device, { fetch: offline.fetch });
  expect(store.get()).toMatchObject({ me: HIRSCH, people: [{ name: "Hirsch" }, { name: "Herzii" }], dogs: [{ name: "Toffee" }], unsent: 1, view: { walk: { key: "w1", dogIds: [1] } } });
  await store.refresh();
  expect(store.get()).toMatchObject({ online: false, view: { walk: { key: "w1" } } });
  store.send({ id: "p1", at: new Date().toISOString(), kind: "log", type: "pee", dogId: 1 });
  await settle();
  expect(JSON.parse(localStorage.getItem("gassi.commands.p-hirsch")!).map((c: Command) => c.id)).toEqual(["s1", "p1"]);
});

test("a refresh that goes wrong in an unexpected way keeps the state and rejects nothing", async () => {
  const server = household();
  server.handlers["GET /api/me"] = () => {
    throw new Error("boom");
  };
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: server.fetch });
  await expect(store.refresh()).resolves.toBeUndefined();
  expect(store.get().me).toEqual(HIRSCH);
});

test("a sessions answer asked for before a tap's answer came back does not undo the tap", async () => {
  const server = household();
  const walk = { key: "w1", startedAt: "2026-10-21T10:00:00.000Z", dogIds: [1], walkers: [HIRSCH], pauses: [], paused: false, recorder: null };
  server.handlers["POST /api/commands"] = () => ({ applied: ["s1"], dropped: [], view: { walk, training: null } });
  // the sessions answer is held back until the tap's answer is in: it shows the server before the tap
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  let asked = () => {};
  const sessionsAsked = new Promise<void>((r) => (asked = r));
  const fetchFn: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/sessions")) {
      asked();
      await held;
      return new Response(JSON.stringify({ walk: null, training: null }), { headers: { "content-type": "application/json" } });
    }
    return server.fetch(input, init);
  };
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: fetchFn });
  const refreshing = store.refresh();
  await sessionsAsked; // the refresh now waits for the sessions answer
  store.send(start("s1"));
  await settle();
  expect(store.get()).toMatchObject({ unsent: 0, view: { walk: { key: "w1" } } });
  release();
  await refreshing;
  expect(store.get().view.walk).toMatchObject({ key: "w1" });
});

test("the queue goes out even when one of the household's calls fails", async () => {
  const server = household();
  server.handlers["GET /api/people"] = () => status(500, { error: "Kaputt." });
  const store = createGassiStore({ token: "t", serverUrl: "", person: HIRSCH }, { fetch: server.fetch });
  server.reachable = false;
  store.send(start("s1"));
  await settle();
  server.reachable = true;
  await store.refresh();
  expect(server.calls.some((c) => c.route === "POST /api/commands")).toBe(true);
  expect(store.get().unsent).toBe(0);
});

test("a household that came is kept, also when the sessions don't come", async () => {
  const device = { token: "t", serverUrl: "", person: HIRSCH };
  saveDevice(device);
  const server = household();
  server.handlers["GET /api/sessions"] = () => status(500, { error: "Kaputt." });
  await createGassiStore(device, { fetch: server.fetch }).refresh();
  expect(loadKept("snapshot")).toMatchObject({ dogs: [{ name: "Toffee" }], people: [{ name: "Hirsch" }, { name: "Herzii" }] });
});

test("an answer that comes after this device was signed out keeps nothing", async () => {
  const device = { token: "t", serverUrl: "", person: HIRSCH };
  saveDevice(device);
  const server = household();
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  const fetchFn: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/sessions")) await held;
    return server.fetch(input, init);
  };
  const refreshing = createGassiStore(device, { fetch: fetchFn }).refresh();
  await settle();
  forgetDevice(); // a 401 elsewhere, or Abmelden
  release();
  await refreshing;
  expect(loadKept("snapshot")).toBeNull();
});

test("knows its device, and a walk it starts shows it as recording the route (#104)", async () => {
  const device = { token: "t", serverUrl: "", person: HIRSCH };
  saveDevice(device);
  const store = createGassiStore(device, { fetch: household().fetch });
  await store.refresh();
  expect(store.get().device).toEqual({ id: 1, name: "iPhone (Web)" });
  const offline = createGassiStore(device, { fetch: (() => Promise.reject(new TypeError("offline"))) as typeof fetch });
  expect(offline.get().device).toEqual({ id: 1, name: "iPhone (Web)" }); // kept from the last answer
  offline.send(start("s1"));
  await settle();
  expect(offline.get().view.walk?.recorder).toEqual({ deviceId: 1, name: "iPhone (Web)" });
});
