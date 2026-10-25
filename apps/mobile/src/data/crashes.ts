// Errors nobody caught, for the server (events.ts): on Android React Native's global handler, which then still
// shows the error screen or ends the app as before. A crash that ends the app may end it before its report is out.
// The web listens to the browser (crashes.web.ts).

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtils = { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void };

/** Calls `fn` with each uncaught error; returns the stop. */
export function onCrash(fn: (error: unknown) => void): () => void {
  const utils = (globalThis as { ErrorUtils?: ErrorUtils }).ErrorUtils;
  if (!utils) return () => {};
  const before = utils.getGlobalHandler();
  const ours: Handler = (error, isFatal) => {
    fn(error);
    before(error, isFatal);
  };
  utils.setGlobalHandler(ours);
  // a handler installed after ours stays
  return () => {
    if (utils.getGlobalHandler() === ours) utils.setGlobalHandler(before);
  };
}
