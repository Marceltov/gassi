// Where the command queue (@gassi/domain's createCommandQueue) keeps its taps. The web keeps them in localStorage
// (queue.web.ts); the Android app (step 3) brings its own file next to this one. Until then a native build keeps
// them only while it runs.
export type QueueStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const memory = new Map<string, string>();

export function queueStorage(): QueueStorage {
  return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
}

/** Calls `fn` when another tab or process changed the queue under `key`; returns the unsubscribe. */
export function onQueueChanged(_key: string, _fn: () => void): () => void {
  return () => {};
}
