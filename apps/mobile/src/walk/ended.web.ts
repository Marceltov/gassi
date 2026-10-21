// The walk this phone ended last, in localStorage. Same interface as ended.ts ("./ended" means this file on the web,
// so that one is named with its extension).
import type * as Native from "./ended.ts";
import type { Ended } from "./taps";

const KEY = "gassi.endedWalk";

export function loadEnded(key: string): Ended | null {
  try {
    const e = JSON.parse(localStorage.getItem(KEY) ?? "null") as Ended | null;
    return e?.key === key && Array.isArray(e.taps) && Array.isArray(e.walkers) && Array.isArray(e.pauses) ? e : null;
  } catch {
    return null;
  }
}

export function saveEnded(e: Ended): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    // storage full or blocked: the summary waits for the server
  }
}

const sameAsNative: typeof Native = { loadEnded, saveEnded };
void sameAsNative;
