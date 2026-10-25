// Errors nobody caught, from the browser: thrown ones and promises rejected without a catch. Same interface as
// crashes.ts.
import type * as Native from "./crashes.ts";

export function onCrash(fn: (error: unknown) => void): () => void {
  const thrown = (e: ErrorEvent) => fn(e.error ?? e.message);
  const rejected = (e: PromiseRejectionEvent) => fn(e.reason);
  window.addEventListener("error", thrown);
  window.addEventListener("unhandledrejection", rejected);
  return () => {
    window.removeEventListener("error", thrown);
    window.removeEventListener("unhandledrejection", rejected);
  };
}

const sameAsNative: typeof Native = { onCrash };
void sameAsNative;
