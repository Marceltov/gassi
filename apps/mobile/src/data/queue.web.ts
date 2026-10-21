// The command queue's taps in localStorage, shared by every tab of the app; another tab's change arrives as a storage
// event. Where storage can't be used (blocked, full), the taps stay in memory for this page. Same interface as
// queue.ts ("./queue" means this file on the web, so that one is named with its extension).
import type * as Native from "./queue.ts";

const memory = new Map<string, string>();

export function queueStorage(): Native.QueueStorage {
  // localStorage looked up on each call: a test (or a browser that blocks storage) may swap or lack it
  return {
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return memory.get(k) ?? null;
      }
    },
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        memory.set(k, v);
      }
    },
  };
}

export function onQueueChanged(key: string, fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

const sameAsNative: typeof Native = { queueStorage, onQueueChanged };
void sameAsNative;
