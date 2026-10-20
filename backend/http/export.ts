// GET /export.csv: every entry as CSV, for whoever is signed in.
import { readCookie } from "../auth/cookies";
import { SESSION_COOKIE, sessionUser } from "../auth/session";
import { entriesCsv } from "../csv";
import { type Diary, diary } from "../diary";
import { dayOf } from "../../shared/time";

export async function exportRoute(req: Request, open: () => Promise<Diary> = diary, now = Date.now()): Promise<Response> {
  if (!sessionUser(readCookie(req.headers, SESSION_COOKIE), now)) return new Response("Bitte erst anmelden.", { status: 401 });
  const d = await open();
  const name = `gassi-${dayOf(now, d.timeZone)}.csv`;
  return new Response(entriesCsv(await d.all(), d.timeZone), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
