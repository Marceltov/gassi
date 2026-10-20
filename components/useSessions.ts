"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { type Command, newId } from "@/shared/commands";
import { type Person, project, type SessionsView } from "@/shared/sessionProjection";
import { type CommandAnswer, type CommandQueue, createCommandQueue, RejectedCommands, STORAGE_KEY } from "./commandQueue";

// The walk and training as a screen shows them: the server's view with this phone's unsent taps laid over it. One
// queue per person and browser tab, shared by every screen, so a tap on Heute is still pending on /runde.

const FLUSH_MS = 15_000;

async function send(commands: Command[]): Promise<CommandAnswer> {
  const res = await fetch("/api/commands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commands }) });
  if (res.status === 400) throw new RejectedCommands(); // they can never apply; keeping them would block the rest
  if (!res.ok) throw new Error(`commands: ${res.status}`);
  return res.json();
}

let shared: { username: string; queue: CommandQueue } | null = null;

function queueFor(username: string): CommandQueue {
  if (shared?.username !== username) {
    const memory = new Map<string, string>();
    let storage: Pick<Storage, "getItem" | "setItem">;
    try {
      storage = window.localStorage;
    } catch {
      storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
    }
    shared = { username, queue: createCommandQueue({ storage, send, key: `${STORAGE_KEY}.${username}` }) };
  }
  return shared.queue;
}

/** A command body without id and time; `push` adds both (the time is the tap's). */
export type CommandBody = Command extends infer C ? (C extends Command ? Omit<C, "id" | "at"> : never) : never;

/** `onAnswer` runs after the server confirmed taps (Heute reloads its lists then). */
const NONE: readonly Command[] = [];

export function useSessions(initial: SessionsView, user: Person, onAnswer?: () => void) {
  // The newest of: the page's data (it changes when the page reloads) and the view in the server's last answer.
  const [server, setServer] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setServer(initial);
  }

  const pending = useSyncExternalStore(
    useCallback((onChange: () => void) => queueFor(user.username).subscribe(onChange), [user.username]),
    () => queueFor(user.username).pending(),
    () => NONE,
  );

  useEffect(() => {
    const queue = queueFor(user.username);
    const unsubscribe = queue.subscribe((_, view) => {
      if (view) {
        setServer(view);
        onAnswer?.();
      }
    });
    const flush = () => void queue.flush();
    const refresh = (e: StorageEvent) => e.key === `${STORAGE_KEY}.${user.username}` && queue.refresh();
    window.addEventListener("online", flush);
    window.addEventListener("storage", refresh);
    const id = setInterval(flush, FLUSH_MS);
    flush();
    return () => {
      unsubscribe();
      window.removeEventListener("online", flush);
      window.removeEventListener("storage", refresh);
      clearInterval(id);
    };
  }, [user.username, onAnswer]);

  // Resolves once the server answered or sending failed (no reception), at the latest after 3 s: screens wait for it
  // before they navigate, so the next page already shows the tap.
  const push = useCallback(
    (body: CommandBody): Promise<void> => {
      const sent = queueFor(user.username).push({ id: newId(), at: new Date().toISOString(), ...body } as Command);
      return Promise.race([sent, new Promise<void>((r) => setTimeout(r, 3000))]);
    },
    [user.username],
  );

  return { view: project(server, pending, user), pending: pending.length, push };
}

export { newId };

/** "Hirsch" or "Hirsch + Herzii". */
export const walkerNames = (walkers: readonly Person[]) => walkers.map((w) => w.name).join(" + ");

/** "Hirsch ist" / "Hirsch + Herzii sind". */
export const walkersAre = (walkers: readonly Person[]) => `${walkerNames(walkers)} ${walkers.length > 1 ? "sind" : "ist"}`;
