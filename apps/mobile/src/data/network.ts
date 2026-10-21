// Being back online. The web hears it from the browser (network.web.ts); the Android app (step 3) brings its own
// file next to this one. Until then a native build waits for the next refresh.
export function onReconnect(_fn: () => void): () => void {
  return () => {};
}
