// What this phone keeps of what the server showed, so a reopened app has it before (or without) an answer: the
// household and sessions (snapshot.ts), the walk ended last (walk/ended.ts), the food sheet's facts (food/memory.ts).
// One place, so signing out forgets all of it at once (api.ts forgetDevice); the queue of unsent taps and the device
// are kept elsewhere. The web keeps it in localStorage (kept.web.ts); a native build only while it runs, until the
// Android app (step 3) brings its storage next to this file.
const memory = new Map<string, string>();

/** What was kept under `key` (as saved; the caller checks its shape), or null. */
export function loadKept(key: string): unknown {
  const raw = memory.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as unknown);
}

export function saveKept(key: string, value: unknown): void {
  memory.set(key, JSON.stringify(value));
}

export function dropKept(key: string): void {
  memory.delete(key);
}

/** Forgets everything kept (signing out). */
export function clearKept(): void {
  memory.clear();
}
