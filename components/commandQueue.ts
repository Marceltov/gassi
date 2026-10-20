// The phone's queue of walk and training taps the server has not confirmed yet, kept in localStorage so nothing is
// lost without reception or when the app is closed. It holds commands only, never a copy of the walk: the server's
// answer carries the walk as it is. A command leaves the queue once the server lists it as applied or dropped.
import type { Command } from "@/shared/commands";
import type { SessionsView } from "@/shared/sessionProjection";

export const STORAGE_KEY = "gassi.commands";
const BATCH = 100;

export type CommandAnswer = { applied: string[]; dropped: string[]; view: SessionsView };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Listener = (pending: Command[], view?: SessionsView) => void;

export type CommandQueue = {
  push(cmd: Command): Promise<void>;
  flush(): Promise<void>;
  pending(): Command[];
  subscribe(fn: Listener): () => void;
};

function load(storage: Storage): Command[] {
  try {
    const v = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function createCommandQueue({ storage, send }: { storage: Storage; send: (commands: Command[]) => Promise<CommandAnswer> }): CommandQueue {
  let queue = load(storage);
  const listeners = new Set<Listener>();
  let inFlight: Promise<void> | null = null;
  let again = false;

  const save = (view?: SessionsView) => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // storage full or blocked: the queue still lives in memory for this page
    }
    for (const fn of listeners) fn([...queue], view);
  };

  async function sendOnce(): Promise<void> {
    const batch = queue.slice(0, BATCH);
    if (batch.length === 0) return;
    let answer: CommandAnswer;
    try {
      answer = await send(batch);
    } catch {
      return; // no reception or a server error: keep everything and try again later
    }
    const done = new Set([...answer.applied, ...answer.dropped]);
    queue = queue.filter((c) => !done.has(c.id));
    save(answer.view);
  }

  // One send at a time; a flush asked for meanwhile runs once more afterwards, for what was pushed in between.
  function flush(): Promise<void> {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = sendOnce().finally(() => {
      inFlight = null;
      if (again) {
        again = false;
        return flush();
      }
    });
    return inFlight;
  }

  return {
    push(cmd) {
      queue = [...queue, cmd];
      save();
      return flush();
    },
    flush,
    pending: () => [...queue],
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
