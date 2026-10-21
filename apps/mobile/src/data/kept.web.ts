// What this phone keeps of what the server showed, in localStorage under "gassi.kept.<key>". Same interface as
// kept.ts ("./kept" means this file on the web, so that one is named with its extension).
import type * as Native from "./kept.ts";

const PREFIX = "gassi.kept.";

export function loadKept(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key) ?? "null") as unknown;
  } catch {
    return null; // storage blocked, or something unreadable: nothing kept
  }
}

export function saveKept(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the next start waits for the server
  }
}

export function dropKept(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // nothing kept then either
  }
}

export function clearKept(): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const k of keys) if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    // nothing kept then either
  }
}

const sameAsNative: typeof Native = { loadKept, saveKept, dropKept, clearKept };
void sameAsNative;
