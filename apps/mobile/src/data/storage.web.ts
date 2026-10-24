// What survives a reload, in localStorage, shared by every tab of the app; another tab's change arrives as a storage
// event. Where storage can't be used (blocked, full), values stay in memory for this page. Same interface as
// storage.ts ("./storage" means this file on the web, so that one is named with its extension).
import type * as Native from "./storage.ts";

const memory = new Map<string, string>();

// localStorage looked up on each call: a test (or a browser that blocks storage) may swap or lack it
export const storage: Native.KeyValue = {
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
  removeItem: (k) => {
    memory.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {
      // only in memory then
    }
  },
  keys: () => {
    let stored: string[] = [];
    try {
      stored = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k) => k !== null);
    } catch {
      // only memory then
    }
    return [...new Set([...stored, ...memory.keys()])];
  },
};

export function onStoredElsewhere(key: string, fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

const sameAsNative: typeof Native = { storage, onStoredElsewhere };
void sameAsNative;
