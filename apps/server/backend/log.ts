// The one logger: pino, one JSON line per event on stdout. Never log tokens, codes, cookies, secrets, state, nonce,
// addresses or claim values; the redaction below is only a safety net.
import pino, { type Logger } from "pino";
import { processState } from "./state";

const REDACT = ["token", "code", "state", "nonce", "cookie", "authorization", "secret", "email", "*.token", "*.cookie", "*.authorization", "*.secret"];

type Sink = { write(line: string): unknown };

// LOG_LEVEL is read directly, not through config(): logging must work while the configuration is being reported broken.
const state = processState("log", () => {
  const s = { sink: pino.destination(1) as Sink, children: new Map<string, Logger>() };
  const root = pino(
    {
      level: process.env.LOG_LEVEL || "info",
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT, censor: "[redacted]" },
    },
    { write: (line: string) => void s.sink.write(line) },
  );
  return Object.assign(s, { root });
});

export function logger(component: string): Logger {
  let child = state.children.get(component);
  if (!child) state.children.set(component, (child = state.root.child({ component })));
  return child;
}

// For tests: every logger writes to `write` at `level` until the returned function puts things back.
export function logTo(write: (line: string) => void, level = "debug"): () => void {
  const before = { sink: state.sink, level: state.root.level };
  const setLevel = (l: string) => {
    state.root.level = l;
    for (const c of state.children.values()) c.level = l;
  };
  state.sink = { write };
  setLevel(level);
  return () => {
    state.sink = before.sink;
    setLevel(before.level);
  };
}
