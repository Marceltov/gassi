// Where this app keeps what survives a restart: the device, the command queue's taps, and what it kept of the server's
// answers (kept.ts). On Android in SQLite's key-value store (expo-sqlite/kv-store), which reads and writes
// synchronously like localStorage; the web keeps it in localStorage (storage.web.ts, the same interface).
import Storage from "expo-sqlite/kv-store";

export type KeyValue = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
};

export const storage: KeyValue = {
  getItem: (k) => Storage.getItemSync(k),
  setItem: (k, v) => Storage.setItemSync(k, v),
  removeItem: (k) => void Storage.removeItemSync(k),
  keys: () => Storage.getAllKeysSync(),
};

/** Calls `fn` when another tab changed `key`; one process holds the app here, so never. Returns the unsubscribe. */
export function onStoredElsewhere(_key: string, _fn: () => void): () => void {
  return () => {};
}
