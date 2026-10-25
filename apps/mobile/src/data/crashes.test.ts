import { afterEach, expect, test } from "vitest";
import { onCrash } from "./crashes.ts";

type Handler = (error: unknown, isFatal?: boolean) => void;
const g = globalThis as { ErrorUtils?: unknown };

// React Native's global handler, as a stand-in
function errorUtils(first: Handler) {
  let handler = first;
  g.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: (h: Handler) => (handler = h) };
  return { current: () => handler };
}

afterEach(() => {
  delete g.ErrorUtils;
});

test("onCrash reports an uncaught error and still hands it on", () => {
  const seen: unknown[] = [];
  const utils = errorUtils((e) => seen.push(e));
  const reported: string[] = [];
  const stop = onCrash((m) => reported.push(m));
  utils.current()(new Error("kaputt"), true);
  expect(reported).toHaveLength(1);
  expect(reported[0]).toContain("kaputt");
  expect(seen).toHaveLength(1);
  stop();
  utils.current()(new Error("danach"));
  expect(reported).toHaveLength(1);
});

test("stopping keeps a handler installed after ours", () => {
  const utils = errorUtils(() => {});
  const stop = onCrash(() => {});
  const later: Handler = () => {};
  (g.ErrorUtils as { setGlobalHandler(h: Handler): void }).setGlobalHandler(later);
  stop();
  expect(utils.current()).toBe(later);
});
