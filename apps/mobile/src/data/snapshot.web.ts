// The last household and sessions in localStorage (one, of the person signed in). Same interface as snapshot.ts
// ("./snapshot" means this file on the web, so that one is named with its extension).
import type * as Native from "./snapshot.ts";

export const SNAPSHOT_KEY = "gassi.snapshot";

export function loadSnapshot(personId: string): Native.Snapshot | null {
  try {
    const s = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null") as Native.Snapshot | null;
    // only the fields the store reads, each of the right shape; anything else counts as none
    const ok = s?.me?.id === personId && Array.isArray(s.people) && Array.isArray(s.dogs) && Array.isArray(s.exercises) && Array.isArray(s.treatKinds) && typeof s.view === "object" && s.view !== null;
    return ok ? s : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(s: Native.Snapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: the next start waits for the server
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // nothing kept then either
  }
}

const sameAsNative: typeof Native = { loadSnapshot, saveSnapshot, clearSnapshot };
void sameAsNative;
