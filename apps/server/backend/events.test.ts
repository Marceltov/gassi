import { expect, test } from "vitest";
import { freshDatabase, HERZII } from "./db/testing";
import { Devices } from "./auth/devices";
import { dropOldEvents, startEventCleanup, storeEvents } from "./events";

const { db } = freshDatabase();
const NOW = Date.parse("2026-10-25T12:00:00Z");
const DAY = 86_400_000;
const at = (ms: number) => new Date(ms).toISOString();
const batch = {
  events: [
    { id: "e1", at: at(NOW - 1000), kind: "error" as const, name: "Senden", data: { message: "kaputt", stack: "Error: kaputt\n  at x" } },
    { id: "e2", at: at(NOW - 500), kind: "screen" as const, name: "/verlauf" },
  ],
  version: "0.3.0",
  platform: "android",
};
const device = async () => (await new Devices(db(), () => new Date(NOW)).create(HERZII.id, { kind: "phone", name: "Testgerät" })).device.id;
const rows = () => db().selectFrom("client_event").selectAll().orderBy("id").execute();

test("storeEvents keeps each event once: the same batch again stores nothing", async () => {
  const id = await device();
  expect(await storeEvents(db(), id, HERZII.id, batch, at(NOW), "all")).toHaveLength(2);
  expect(await storeEvents(db(), id, HERZII.id, batch, at(NOW), "all")).toHaveLength(0);
  const kept = await rows();
  expect(kept.map((r) => [r.id, r.kind, r.name, r.platform, r.version, r.person_id])).toEqual([
    ["e1", "error", "Senden", "android", "0.3.0", HERZII.id],
    ["e2", "screen", "/verlauf", "android", "0.3.0", HERZII.id],
  ]);
  expect(JSON.parse(kept[0]!.data!)).toEqual({ message: "kaputt", stack: "Error: kaputt\n  at x" });
  expect(kept[1]!.data).toBeNull();
});

test("storeEvents keeps only errors when the server wants errors, and nothing when it wants none", async () => {
  const id = await device();
  expect(await storeEvents(db(), id, HERZII.id, batch, at(NOW), "errors")).toHaveLength(1);
  expect((await rows()).map((r) => r.kind)).toEqual(["error"]);
  const other = await device();
  expect(await storeEvents(db(), other, HERZII.id, batch, at(NOW), "off")).toHaveLength(0);
  expect(await rows()).toHaveLength(1);
});

test("dropOldEvents deletes what was received over 30 days ago", async () => {
  const id = await device();
  await storeEvents(db(), id, HERZII.id, { ...batch, events: [batch.events[0]!] }, at(NOW - 31 * DAY), "all");
  await storeEvents(db(), id, HERZII.id, { ...batch, events: [batch.events[1]!] }, at(NOW - 29 * DAY), "all");
  expect(await dropOldEvents(db(), NOW)).toBe(1);
  expect((await rows()).map((r) => r.id)).toEqual(["e2"]);
});

test("startEventCleanup cleans right away and then every hour; a failure goes to onError", async () => {
  const id = await device();
  await storeEvents(db(), id, HERZII.id, batch, at(NOW - 31 * DAY), "all");
  let tick: (() => Promise<void>) | null = null;
  let every = 0;
  const errors: unknown[] = [];
  await startEventCleanup({ db: db(), now: () => NOW, every: (fn, ms) => ((tick = fn), (every = ms)), onError: (e) => errors.push(e) });
  expect(await rows()).toEqual([]);
  expect(every).toBe(3_600_000);
  await startEventCleanup({ db: null as never, now: () => NOW, every: () => {}, onError: (e) => errors.push(e) });
  expect(errors).toHaveLength(1);
  expect(tick).not.toBeNull();
});
