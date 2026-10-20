// One log line per request answered by a route handler: method, path (no query: it may carry a code), status and time.
// Never headers, cookies or bodies.
import { logger } from "../log";

const log = logger("http");

type Handler = (req: Request) => Promise<Response> | Response;

export function logged(handler: Handler): (req: Request) => Promise<Response> {
  return async (req) => {
    const started = performance.now();
    const path = new URL(req.url).pathname;
    try {
      const res = await handler(req);
      const fields = { method: req.method, path, status: res.status, ms: Math.round(performance.now() - started) };
      if (path === "/health" && res.ok) log.debug(fields, "request");
      else log.info(fields, "request");
      return res;
    } catch (e) {
      log.error({ method: req.method, path, err: e }, "request failed");
      throw e;
    }
  };
}
