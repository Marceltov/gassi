import { afterEach, describe, expect, test } from "vitest";
import { freshDatabase, HERZII } from "../db/testing";
import { logTo } from "../log";
import { Throttle } from "../auth/throttle";
import { apiCaller } from "./testing";

const { db } = freshDatabase();
const NOW = new Date("2026-10-25T12:00:00Z");
let restore = () => {};
afterEach(() => restore());

const events = [
  { id: "e1", at: "2026-10-25T11:59:00.000Z", kind: "error", name: "Runde und Training", data: { message: "Die Antwort passt nicht.", stack: "Error: x\n  at y" } },
  { id: "e2", at: "2026-10-25T11:59:30.000Z", kind: "screen", name: "/verlauf" },
];
const body = { events, version: "0.3.0", platform: "android" };

describe("the app's events", () => {
  test("are kept once each; errors also go to the log, one line each, with who, which device and the stack", async () => {
    const lines: Record<string, unknown>[] = [];
    restore = logTo((line) => void lines.push(JSON.parse(line)));
    const { json, tokenFor } = apiCaller(db, () => NOW);
    const token = await tokenFor(HERZII.id);
    expect(await json("/api/events", { method: "POST", token, body })).toEqual({ status: 200, body: { received: 2, wants: "all" } });
    expect(await json("/api/events", { method: "POST", token, body })).toEqual({ status: 200, body: { received: 0, wants: "all" } });
    expect(await db().selectFrom("client_event").select(["id", "kind"]).orderBy("id").execute()).toEqual([
      { id: "e1", kind: "error" },
      { id: "e2", kind: "screen" },
    ]);
    const logged = lines.filter((l) => l.component === "client-error");
    expect(logged).toEqual([
      expect.objectContaining({ level: "warn", person: "Herzii", device: "Testgerät", kind: "phone", version: "0.3.0", platform: "android", name: "Runde und Training", message: "Die Antwort passt nicht.", stack: "Error: x\n  at y" }),
    ]);
  });

  test("the server's setting decides what it keeps, and it tells the app", async () => {
    const { json, tokenFor } = apiCaller(db, () => NOW, () => ({ clientEvents: "errors" }));
    const token = await tokenFor(HERZII.id);
    expect(await json("/api/events", { method: "POST", token, body })).toEqual({ status: 200, body: { received: 1, wants: "errors" } });
  });

  test("a device that sends too often waits (429)", async () => {
    const eventThrottle = new Throttle({ client: { burst: 2, everyMs: 60_000 }, all: { burst: 100, everyMs: 1000 } });
    const { json, tokenFor } = apiCaller(db, () => NOW, () => ({ eventThrottle }));
    const token = await tokenFor(HERZII.id);
    const one = (id: string) => ({ ...body, events: [{ ...events[1], id }] });
    expect((await json("/api/events", { method: "POST", token, body: one("a") })).status).toBe(200);
    expect((await json("/api/events", { method: "POST", token, body: one("b") })).status).toBe(200);
    expect((await json("/api/events", { method: "POST", token, body: one("c") })).status).toBe(429);
  });

  test("an event's data can't pass itself off as another person or device in the log", async () => {
    const lines: Record<string, unknown>[] = [];
    restore = logTo((line) => void lines.push(JSON.parse(line)));
    const { json, tokenFor } = apiCaller(db, () => NOW);
    const token = await tokenFor(HERZII.id);
    const forged = { ...events[0], id: "f1", data: { message: "x", person: "Hirsch", device: "Anderes" } };
    await json("/api/events", { method: "POST", token, body: { ...body, events: [forged] } });
    expect(lines.find((l) => l.component === "client-error")).toMatchObject({ person: "Herzii", device: "Testgerät" });
  });

  test("need a signed-in device", async () => {
    const { json } = apiCaller(db, () => NOW);
    expect((await json("/api/events", { method: "POST", body })).status).toBe(401);
  });

  test("too much in one event is refused", async () => {
    const { json, tokenFor } = apiCaller(db, () => NOW);
    const token = await tokenFor(HERZII.id);
    const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]));
    expect((await json("/api/events", { method: "POST", token, body: { ...body, events: [{ ...events[1], data: many }] } })).status).toBe(400);
    expect((await json("/api/events", { method: "POST", token, body: { ...body, events: [{ ...events[1], data: { stack: "x".repeat(4001) } }] } })).status).toBe(400);
  });
});
