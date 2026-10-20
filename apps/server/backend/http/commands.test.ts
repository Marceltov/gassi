import { expect, test } from "vitest";
import { sessionCookie } from "../auth/session";
import { freshDatabase } from "../db/testing";
import { Sessions } from "../sessions";
import { withEnv } from "../testing/env";
import { commandsRoute } from "./commands";

withEnv();
const { db } = freshDatabase();
const NOW = Date.parse("2026-10-20T10:00:00Z");
const open = async () => new Sessions({ db: db(), dog: { id: 1, name: "Toffee" }, names: new Map([["marcel", "Hirsch"]]), now: () => new Date(NOW) });
const signedIn = () => ({ cookie: sessionCookie({ username: "marcel", name: "Hirsch" }, NOW).split(";")[0] });
const post = (body: unknown, headers: Record<string, string> = signedIn()) =>
  commandsRoute(new Request("https://gassi.example/api/commands", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), open, NOW);

const start = { id: "c1", at: "2026-10-20T09:00:00Z", kind: "walk.start", walkKey: "w" };

test("401 without a session", async () => {
  expect((await post({ commands: [start] }, {})).status).toBe(401);
});

test("415 unless the body is JSON", async () => {
  const res = await commandsRoute(new Request("https://gassi.example/api/commands", { method: "POST", headers: { ...signedIn(), "content-type": "text/plain" }, body: JSON.stringify({ commands: [start] }) }), open, NOW);
  expect(res.status).toBe(415);
});

test("400 on an invalid command or too many", async () => {
  expect((await post({ commands: [{ ...start, kind: "walk.fly" }] })).status).toBe(400);
  expect((await post({ commands: [{ ...start, at: "gestern" }] })).status).toBe(400);
  expect((await post({ nothing: true })).status).toBe(400);
  expect((await post({ commands: Array.from({ length: 101 }, (_, i) => ({ ...start, id: `c${i}` })) })).status).toBe(400);
});

test("applies the commands and answers with what it did and the view", async () => {
  const res = await post({ commands: [start, { id: "c2", at: "2026-10-20T09:05:00Z", kind: "walk.stop", walkKey: "nope" }] });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({
    applied: ["c1"],
    dropped: ["c2"],
    view: { walk: { key: "w", startedAt: "2026-10-20T09:00:00.000Z", walkers: [{ username: "marcel", name: "Hirsch" }], pauses: [], paused: false }, training: null },
  });
});
