// What happens in the app, for the household's own server (#115, ADR 0016): errors with their stacks, screens, taps,
// commands, sync and recording health. One stream for all of them: an event is kept in storage under the kept prefix
// (so it survives a restart and an offline walk, and a sign-out forgets it), the newest 2000 at most, and the store
// sends them in batches of 100 (`flush`); at most about 500 KB are kept, so long stacks can't push the command queue
// out of a browser's storage. A batch the server refuses is dropped, not sent forever; without reception
// it waits. The same error goes at most once a minute (kept too: a crash at every start is one a minute). The server's answer says what it keeps (all, only errors,
// nothing), and only that is recorded from then on; with nothing to send the app asks again once an hour. Recording
// never throws: telemetry must not break a tap. The background task (track/background.ts) records here too.
import { ApiError, type ClientEvent, type ClientEventWants, EVENT_DATA_KEYS, EVENT_TEXT } from "@gassi/api-client";
import { newId as domainId } from "@gassi/domain";
import { loadKept, saveKept, saveKeptText } from "./kept";

export type EventKind = ClientEvent["kind"];
export type EventData = NonNullable<ClientEvent["data"]>;
type Kept = { wants: ClientEventWants; events: ClientEvent[]; recent: Record<string, number> }; // recent: an error → when

const KEY = "events";
const KEEP = 2000;
const KEEP_CHARS = 500_000;
const BATCH = 100;
const AGAIN_MS = 60_000;
const ASK_MS = 3_600_000;
const NAME = 80;

export type Events = {
  record(kind: Exclude<EventKind, "error">, name: string, data?: EventData): void;
  error(name: string, e: unknown, data?: EventData): void;
  /** The screen now open: recorded, and named in each error after it. */
  screen(path: string): void;
  /** Forgets which errors went out in the last minute (a sign-out forgets the events themselves). */
  forget(): void;
  flush(send: (batch: ClientEvent[]) => Promise<{ wants: ClientEventWants }>): Promise<void>;
  waiting(): readonly ClientEvent[];
};

// what is kept, as written: the newest KEEP, and while that is over KEEP_CHARS the oldest tenth goes (one
// serialization on a usual write)
function serialized(kept: Kept): string {
  let events = kept.events.slice(-KEEP);
  for (;;) {
    const text = JSON.stringify({ ...kept, events });
    if (text.length <= KEEP_CHARS || events.length === 0) return text;
    events = events.slice(Math.ceil(events.length / 10));
  }
}

function load(): Kept {
  const k = loadKept(KEY) as Partial<Kept> | null;
  const wants = k?.wants === "off" || k?.wants === "errors" ? k.wants : "all";
  const recent = k?.recent && typeof k.recent === "object" ? k.recent : {};
  return { wants, events: Array.isArray(k?.events) ? k.events : [], recent };
}

// cut to what the server takes: a few keys, no endless text
function fit(data: EventData | undefined): EventData | undefined {
  if (!data) return undefined;
  const entries = Object.entries(data).slice(0, EVENT_DATA_KEYS);
  return Object.fromEntries(entries.map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, EVENT_TEXT) : v]));
}

/** A crash as one line of text: its stack's first lines (they start with name and message), else what it says. */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  return e.stack?.split("\n").slice(0, 6).join("\n") ?? `${e.name}: ${e.message}`;
}

export function createEvents({ now = () => new Date(), newId = domainId }: { now?: () => Date; newId?: () => string } = {}): Events {
  let sending: Promise<void> | null = null;
  let asked = -Infinity;
  let open: string | null = null; // the screen now open
  const recentHere = new Map<string, number>(); // the same as `recent`, without reading storage for a repeat

  // `again`: an error's name and message, recorded only when not within the last minute
  function add(kind: EventKind, name: string, data?: EventData, again?: string) {
    try {
      const kept = load();
      if (kept.wants === "off" || (kept.wants === "errors" && kind !== "error")) return;
      const at = now().getTime();
      const recent = Object.fromEntries(Object.entries(kept.recent).filter(([, t]) => at - t < AGAIN_MS));
      if (again !== undefined) {
        if (again in recent) return;
        recent[again] = at;
      }
      const event: ClientEvent = { id: newId(), at: new Date(at).toISOString(), kind, name: name.slice(0, NAME), ...(data ? { data: fit(data) } : {}) };
      saveKeptText(KEY, serialized({ ...kept, recent, events: [...kept.events, event] }));
    } catch {
      // storage full or gone: this one is lost, the app goes on
    }
  }

  async function send(post: (batch: ClientEvent[]) => Promise<{ wants: ClientEventWants }>) {
    for (;;) {
      const batch = load().events.slice(0, BATCH);
      if (batch.length === 0 && now().getTime() - asked < ASK_MS) return;
      let wants: ClientEventWants | null = null;
      try {
        asked = now().getTime();
        wants = (await post(batch)).wants;
      } catch (e) {
        // refused for good (400): dropped, so the stream goes on; else (no reception) it waits for the next flush
        if (!(e instanceof ApiError && e.status === 400)) return;
      }
      const ids = new Set(batch.map((e) => e.id));
      const kept = load();
      saveKept(KEY, { ...kept, wants: wants ?? kept.wants, events: wants === "off" ? [] : kept.events.filter((e) => !ids.has(e.id)) });
      if (batch.length === 0) return;
    }
  }

  return {
    record: (kind, name, data) => add(kind, name, data),
    error(name, e, data) {
      let message = "?";
      let stack: string | undefined;
      try {
        message = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, EVENT_TEXT);
        stack = e instanceof Error ? e.stack : undefined;
      } catch {
        // something that can't even be text: the error's name is all there is
      }
      const again = `${name}\n${message}`;
      const at = now().getTime();
      const before = recentHere.get(again);
      if (before !== undefined && at - before < AGAIN_MS) return;
      recentHere.set(again, at);
      add("error", name, { ...(open ? { screen: open } : {}), ...data, message, ...(stack ? { stack } : {}) }, again);
    },
    screen(path) {
      open = path;
      add("screen", path);
    },
    forget: () => recentHere.clear(),
    async flush(post) {
      if (sending) return sending;
      sending = send(post)
        .catch(() => {})
        .finally(() => {
          sending = null;
        });
      return sending;
    },
    waiting: () => load().events,
  };
}

/** The app's one stream, for screens, the store, crashes and the background task. */
export const events = createEvents();
