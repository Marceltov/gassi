// The phone's queue of walk and training taps the server has not confirmed yet, kept in localStorage so nothing is
// lost without reception or when the app is closed. It holds commands only, never a copy of the walk: the server's
// answer carries the walk as it is. A command leaves the queue once the server lists it as applied or dropped, or
// refuses the batch for good (400). Storage is the truth, re-read before every change, so two tabs share one queue.
import type { Command } from "@/shared/commands";
import type { SessionsView } from "@/shared/sessionProjection";

export const STORAGE_KEY = "gassi.commands";
const BATCH = 100;

/** Thrown by `send` when the server refuses the commands for good (they can never apply); they leave the queue. */
export class RejectedCommands extends Error {
  constructor() {
    super("commands refused");
    this.name = "RejectedCommands";
  }
}

export type CommandAnswer = { applied: string[]; dropped: string[]; view: SessionsView };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Listener = (pending: Command[], view?: SessionsView) => void;

export type CommandQueue = {
  push(cmd: Command): Promise<void>;
  flush(): Promise<void>;
  /** The unsent commands; the same array until the queue changes (for useSyncExternalStore). */
  pending(): readonly Command[];
  /** Re-reads storage (another tab changed it) and tells the subscribers. */
  refresh(): void;
  subscribe(fn: Listener): () => void;
};

// null when storage can't be read at all; broken content counts as empty.
function load(storage: Storage, key: string): Command[] | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

type Options = { storage: Storage; send: (commands: Command[]) => Promise<CommandAnswer>; key?: string };

/** `key`: where in `storage` the queue lives; one per person, so taps never go out under someone else's session. */
export function createCommandQueue({ storage, send, key = STORAGE_KEY }: Options): CommandQueue {
  let usable = true; // false once storage failed: the queue then lives in memory for this page
  let queue = load(storage, key) ?? ((usable = false), []);
  const listeners = new Set<Listener>();
  let inFlight: Promise<void> | null = null;
  let again = false;

  const notify = (view?: SessionsView) => {
    for (const fn of listeners) fn(queue, view);
  };
  // the commands as storage has them now (another tab may have added or sent some)
  const current = (): Command[] => {
    if (!usable) return queue;
    const stored = load(storage, key);
    if (stored === null) usable = false;
    return stored ?? queue;
  };
  const save = (next: Command[], view?: SessionsView) => {
    queue = next;
    if (usable) {
      try {
        storage.setItem(key, JSON.stringify(queue));
      } catch {
        usable = false;
      }
    }
    notify(view);
  };

  async function sendOnce(): Promise<void> {
    const batch = current().slice(0, BATCH);
    if (batch.length === 0) return;
    let done: Set<string>;
    let view: SessionsView | undefined;
    try {
      const answer = await send(batch);
      done = new Set([...answer.applied, ...answer.dropped]);
      view = answer.view;
    } catch (e) {
      if (!(e instanceof RejectedCommands)) return; // no reception or a server error: keep everything, try again later
      done = new Set(batch.map((c) => c.id));
    }
    save(current().filter((c) => !done.has(c.id)), view);
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
      save([...current().filter((c) => c.id !== cmd.id), cmd]);
      return flush();
    },
    flush,
    pending: () => queue,
    refresh() {
      const next = current();
      if (JSON.stringify(next) !== JSON.stringify(queue)) {
        queue = next;
        notify();
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
