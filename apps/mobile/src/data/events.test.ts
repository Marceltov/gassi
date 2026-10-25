import { ApiError, type ClientEvent } from "@gassi/api-client";
import { expect, test, vi } from "vitest";
import { createEvents, errorText } from "./events";
import { clearKept } from "./kept";
import { storage } from "./storage";

function setup() {
  let time = Date.parse("2026-10-25T12:00:00Z");
  let n = 0;
  const events = createEvents({ now: () => new Date(time), newId: () => `e${++n}` });
  const sent: ClientEvent[][] = [];
  const server = { reachable: true, wants: "all" as "off" | "errors" | "all", refuse: false };
  const send = async (batch: ClientEvent[]) => {
    if (!server.reachable) throw new ApiError(0, "no reception");
    if (server.refuse) throw new ApiError(400, "refused");
    sent.push(batch);
    return { wants: server.wants };
  };
  return { events, sent, server, send, later: (ms: number) => void (time += ms) };
}

test("events are kept in storage: a restart still has them, a sign-out forgets them", () => {
  const { events } = setup();
  events.record("screen", "/verlauf");
  events.record("tap", "Gassi gehen", { hold: false });
  const again = createEvents();
  expect(again.waiting().map((e) => [e.kind, e.name, e.data])).toEqual([
    ["screen", "/verlauf", undefined],
    ["tap", "Gassi gehen", { hold: false }],
  ]);
  expect(again.waiting()[0]).toMatchObject({ id: "e1", at: "2026-10-25T12:00:00.000Z" });
  clearKept();
  expect(createEvents().waiting()).toEqual([]);
});

test("a phone offline for long keeps the newest 2000", () => {
  const { events } = setup();
  for (let i = 0; i < 2005; i++) events.record("tap", `t${i}`);
  const waiting = events.waiting();
  expect(waiting).toHaveLength(2000);
  expect(waiting[0]!.name).toBe("t5");
  expect(waiting.at(-1)!.name).toBe("t2004");
});

test("flush sends batches of at most 100 until none is left; without reception they wait", async () => {
  const { events, sent, server, send } = setup();
  for (let i = 0; i < 250; i++) events.record("tap", `t${i}`);
  server.reachable = false;
  await events.flush(send);
  expect(events.waiting()).toHaveLength(250);
  server.reachable = true;
  await events.flush(send);
  expect(sent.map((b) => b.length)).toEqual([100, 100, 50]);
  expect(events.waiting()).toEqual([]);
});

test("a batch the server refuses is dropped, not sent forever; the next one goes", async () => {
  const { events, sent, server, send } = setup();
  for (let i = 0; i < 150; i++) events.record("tap", `t${i}`);
  server.refuse = true;
  await events.flush(send);
  expect(events.waiting()).toHaveLength(0);
  expect(sent).toEqual([]);
});

test("the same error at most once a minute", () => {
  const { events, later } = setup();
  for (let i = 0; i < 50; i++) events.error("Absturz", new Error("x"));
  expect(events.waiting()).toHaveLength(1);
  events.error("Absturz", new Error("y"));
  expect(events.waiting()).toHaveLength(2);
  later(61_000);
  events.error("Absturz", new Error("x"));
  expect(events.waiting()).toHaveLength(3);
});

test("an error carries its message and stack", () => {
  const { events } = setup();
  const e = new TypeError("x is undefined");
  events.error("Absturz", e, { screen: "/runde" });
  expect(events.waiting()[0]).toMatchObject({ kind: "error", name: "Absturz", data: { message: "TypeError: x is undefined", stack: e.stack, screen: "/runde" } });
  events.error("Senden", "Die Antwort passt nicht.");
  expect(events.waiting()[1]!.data).toEqual({ message: "Die Antwort passt nicht." });
});

test("what the server wants is what is kept: only errors, nothing, or all again", async () => {
  const { events, server, send, later, sent } = setup();
  events.record("tap", "a");
  server.wants = "errors";
  await events.flush(send);
  events.record("tap", "b");
  events.error("Senden", "kaputt");
  expect(events.waiting().map((e) => e.kind)).toEqual(["error"]);
  server.wants = "off";
  await events.flush(send);
  events.error("Senden", "anders");
  expect(createEvents().waiting()).toEqual([]); // the wish is kept too
  server.wants = "all";
  await events.flush(send); // with nothing waiting it asks only once an hour
  events.record("tap", "c");
  expect(events.waiting()).toEqual([]);
  later(3_600_001);
  await events.flush(send); // an empty batch, to hear what the server wants now
  expect(sent.at(-1)).toEqual([]);
  events.record("tap", "d");
  expect(events.waiting()).toHaveLength(1);
});

test("recording never throws, even when storage does", () => {
  const { events } = setup();
  const spy = vi.spyOn(storage, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  expect(() => events.record("tap", "a")).not.toThrow();
  expect(() => events.error("Absturz", new Error("x"))).not.toThrow();
  spy.mockRestore();
});

test("too long or too much is cut to what the server takes", () => {
  const { events } = setup();
  const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, i]));
  events.record("sync", "x".repeat(100), { ...many, long: "y".repeat(5000) });
  const e = events.waiting()[0]!;
  expect(e.name).toHaveLength(80);
  expect(Object.keys(e.data!)).toHaveLength(20);
  events.error("Absturz", new Error("z".repeat(5000)));
  expect((events.waiting()[1]!.data!.message as string).length).toBeLessThanOrEqual(4000);
});

test("errorText: a crash's first stack lines, or what it says", () => {
  expect(errorText("kaputt")).toBe("kaputt");
  expect(errorText(new Error("x"))).toMatch(/^Error: x/);
});
