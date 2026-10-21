// The browser's "online" event: reception is back, so queued taps can go out at once. Same interface as network.ts.
import type * as Native from "./network.ts";

export function onReconnect(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", fn);
  return () => window.removeEventListener("online", fn);
}

const sameAsNative: typeof Native = { onReconnect };
void sameAsNative;
