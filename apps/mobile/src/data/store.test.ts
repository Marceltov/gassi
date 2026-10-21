import type { Command } from "@gassi/domain";
import { expect, test } from "vitest";
import { createGassiStore } from "./store";
import { household } from "./testing";

const start = (id: string): Command => ({ id, at: new Date().toISOString(), kind: "walk.start", walkKey: "w1" });
const settle = () => new Promise((r) => setTimeout(r, 0));

test("loads the household and the running sessions", async () => {
  const store = createGassiStore({ token: "t", serverUrl: "" }, { fetch: household().fetch });
  expect(store.get().me).toBeNull();
  await store.refresh();
  expect(store.get()).toMatchObject({ me: { name: "Hirsch" }, people: [{ name: "Hirsch" }, { name: "Herzii" }], dogs: [{ name: "Toffee" }], exercises: [{ name: "Sitz" }], online: true, view: { walk: null } });
});

test("a tap without reception stays queued, shows at once, and goes out once the server is back", async () => {
  const server = household();
  const store = createGassiStore({ token: "t", serverUrl: "" }, { fetch: server.fetch });
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
  server.handlers["POST /api/commands"] = () => ({ applied: ["s1"], dropped: [], view: { walk: { key: "w1", startedAt: "2026-10-21T10:00:00.000Z", dogIds: [1], walkers: [{ id: "p-hirsch", name: "Hirsch" }], pauses: [], paused: false }, training: null } });
  server.handlers["GET /api/sessions"] = server.handlers["POST /api/commands"] as never;
  await store.refresh();
  expect(store.get()).toMatchObject({ online: true, unsent: 0, view: { walk: { key: "w1", startedAt: "2026-10-21T10:00:00.000Z" } } });
});

test("subscribers hear about each change", async () => {
  const store = createGassiStore({ token: "t", serverUrl: "" }, { fetch: household().fetch });
  let changes = 0;
  const stop = store.subscribe(() => changes++);
  await store.refresh();
  stop();
  expect(changes).toBeGreaterThan(0);
});
