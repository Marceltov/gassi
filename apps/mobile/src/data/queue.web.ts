// The command queue's taps in localStorage, shared by every tab of the app; another tab's change arrives as a storage
// event. Same interface as queue.ts ("./queue" means this file on the web, so that one is named with its extension).
import type * as Native from "./queue.ts";

export function queueStorage(): Native.QueueStorage {
  // looked up on each call: a test (or a browser that blocks storage) may swap or lack it
  return { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
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
