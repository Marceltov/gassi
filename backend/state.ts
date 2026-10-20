// Process-wide state. Next can load a module once per route bundle, so a module-level value in a route handler and
// in a page might not be the same; globalThis is shared by all of them.
export function processState<T extends object>(key: string, init: () => T): T {
  const g = globalThis as Record<symbol, unknown>;
  return (g[Symbol.for(`gassi.${key}`)] ??= init()) as T;
}
