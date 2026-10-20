import { expect, test } from "vitest";
import type { Command } from "@/shared/commands";
import { type CommandAnswer, createCommandQueue } from "./commandQueue";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};
const pipi = (id: string): Command => ({ id, at: "2026-10-20T09:00:00.000Z", kind: "log", type: "pee" });
const answer = (applied: string[], dropped: string[] = []): CommandAnswer => ({ applied, dropped, view: { walk: null, training: null } });

test("keeps commands while sending fails, in storage, and sends them later", async () => {
  const storage = memory();
  let online = false;
  const sent: string[][] = [];
  const send = async (cs: Command[]) => {
    sent.push(cs.map((c) => c.id));
    if (!online) throw new Error("offline");
    return answer(cs.map((c) => c.id));
  };
  const q = createCommandQueue({ storage, send });
  await q.push(pipi("a"));
  await q.push(pipi("b"));
  expect(q.pending().map((c) => c.id)).toEqual(["a", "b"]);
  expect(JSON.parse(storage.data.get("gassi.commands")!)).toHaveLength(2);

  // a new queue on the same storage (the app was reopened) still has them
  const again = createCommandQueue({ storage, send });
  expect(again.pending().map((c) => c.id)).toEqual(["a", "b"]);
  online = true;
  await again.flush();
  expect(again.pending()).toEqual([]);
  expect(sent.at(-1)).toEqual(["a", "b"]);
  expect(JSON.parse(storage.data.get("gassi.commands")!)).toEqual([]);
});

test("a command leaves the queue only when the server lists it as applied or dropped", async () => {
  const q = createCommandQueue({ storage: memory(), send: async () => answer(["a"], ["b"]) });
  q.push(pipi("a"));
  q.push(pipi("b"));
  q.push(pipi("c"));
  await q.flush();
  expect(q.pending().map((c) => c.id)).toEqual(["c"]);
});

test("subscribers hear the pending commands and the server's view", async () => {
  const q = createCommandQueue({ storage: memory(), send: async (cs) => answer(cs.map((c) => c.id)) });
  const heard: [number, boolean][] = [];
  q.subscribe((pending, view) => heard.push([pending.length, view !== undefined]));
  await q.push(pipi("a"));
  expect(heard).toEqual([
    [1, false],
    [0, true],
  ]);
});

test("one send at a time: a flush while sending waits for it", async () => {
  let calls = 0;
  let release!: () => void;
  const q = createCommandQueue({
    storage: memory(),
    send: async (cs) => {
      calls++;
      await new Promise<void>((r) => (release = r));
      return answer(cs.map((c) => c.id));
    },
  });
  const first = q.push(pipi("a"));
  const second = q.flush();
  release();
  await Promise.all([first, second]);
  expect(calls).toBe(1);
  expect(q.pending()).toEqual([]);
});

test("broken storage starts empty", () => {
  const storage = memory();
  storage.setItem("gassi.commands", "{nope");
  expect(createCommandQueue({ storage, send: async () => answer([]) }).pending()).toEqual([]);
});

test("each person has their own queue under their own key", async () => {
  const storage = memory();
  const q = createCommandQueue({ storage, key: "gassi.commands.bille", send: async () => Promise.reject(new Error("offline")) });
  await q.push(pipi("a"));
  expect(storage.data.has("gassi.commands")).toBe(false);
  expect(JSON.parse(storage.data.get("gassi.commands.bille")!)).toHaveLength(1);
});
