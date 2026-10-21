// GET /health: 200 {"status":"ok"} when the database answers, 503 otherwise. No auth: a probe has no session.
import { database, type DB, ping } from "../db/open";
import { logger } from "../log";

const log = logger("health");

export async function healthRoute(open: () => Promise<DB> = database): Promise<Response> {
  try {
    await ping(await open());
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error({ err: e }, "database check failed");
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
