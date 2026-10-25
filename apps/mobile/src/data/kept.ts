// What this phone keeps of what the server showed, so a reopened app has it before (or without) an answer: the
// household and sessions (snapshot.ts), the walk ended last (walk/ended.ts), the food sheet's facts (food/memory.ts).
// Under "gassi.kept.<key>" in storage.ts, so signing out forgets all of it at once (api.ts forgetDevice) and nothing
// else; the queue of unsent taps and the device are kept under their own keys.
import { storage } from "./storage";

const PREFIX = "gassi.kept.";

/** What was kept under `key` (as saved; the caller checks its shape), or null. */
export function loadKept(key: string): unknown {
  try {
    return JSON.parse(storage.getItem(PREFIX + key) ?? "null") as unknown;
  } catch {
    return null; // something unreadable: nothing kept
  }
}

export function saveKept(key: string, value: unknown): void {
  storage.setItem(PREFIX + key, JSON.stringify(value));
}

/** As saveKept, for a value already turned into JSON (events.ts measures its length). */
export function saveKeptText(key: string, json: string): void {
  storage.setItem(PREFIX + key, json);
}

export function dropKept(key: string): void {
  storage.removeItem(PREFIX + key);
}

/** Forgets everything kept (signing out). */
export function clearKept(): void {
  for (const k of storage.keys()) if (k.startsWith(PREFIX)) storage.removeItem(k);
}
