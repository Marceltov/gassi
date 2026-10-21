// GET /export.csv: every entry as CSV, for a signed-in device (Bearer token).
import { dayOf } from "@gassi/domain";
import { Devices } from "../auth/devices";
import { entriesCsv } from "../csv";
import type { DB } from "../db/open";
import { Diary } from "../diary";
import { DogRepository } from "../dogs";
import { PeopleRepository } from "../people";
import { Tracks } from "../tracks";

export type ExportDeps = { db: DB; now: () => Date; timeZone: string };

export async function exportCsv(req: Request, deps: ExportDeps): Promise<Response> {
  if (!(await new Devices(deps.db, deps.now).authenticate(req.headers.get("authorization")))) return new Response("Bitte anmelden.", { status: 401 });
  const d = new Diary({ db: deps.db, names: await new PeopleRepository(deps.db).names(), timeZone: deps.timeZone, now: deps.now });
  const entries = await d.all();
  const dogNames = new Map((await new DogRepository(deps.db).list({ withArchived: true })).map((dog) => [dog.id, dog.name]));
  const distanceM = await new Tracks(deps.db, deps.now).distances(entries.filter((e) => e.type === "walk").map((e) => e.id));
  const name = `gassi-${dayOf(deps.now().getTime(), deps.timeZone)}.csv`;
  return new Response(entriesCsv(entries, deps.timeZone, { dogNames, distanceM }), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
