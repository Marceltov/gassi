// A daily, consistent copy of the database: ${DATA_DIR}/backups/gassi-YYYY-MM-DD.db (the day in TZ), written with
// VACUUM INTO while the app runs, the newest 14 kept. Checked at startup and every hour after.
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sql } from "kysely";
import { dayOf } from "../shared/time";
import type { DB } from "./db/open";

const NAME = /^gassi-\d{4}-\d{2}-\d{2}\.db$/;

/** Writes today's copy when it is missing and deletes the oldest beyond `keep`; the path written, or null. */
export async function backupIfDue(db: DB, dir: string, now: number, timeZone: string, keep = 14): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const name = `gassi-${dayOf(now, timeZone)}.db`;
  const existing = readdirSync(dir).filter((f) => NAME.test(f));
  if (existing.includes(name)) return null;
  const path = join(dir, name);
  await sql`vacuum into ${path}`.execute(db);
  const all = [...existing, name].sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) rmSync(join(dir, old), { force: true });
  return path;
}

type Schedule = { db: DB; dir: string; timeZone: string; now?: () => number; every?: (fn: () => Promise<void>, ms: number) => void; onError: (e: unknown) => void; onWritten?: (path: string) => void };

const HOUR = 3_600_000;

/** Checks now and then every hour; a failed copy is reported to `onError` and tried again the next hour. */
export async function startBackups({ db, dir, timeZone, now = Date.now, every = (fn, ms) => setInterval(fn, ms).unref(), onError, onWritten }: Schedule): Promise<void> {
  const check = async () => {
    try {
      const path = await backupIfDue(db, dir, now(), timeZone);
      if (path) onWritten?.(path);
    } catch (e) {
      onError(e);
    }
  };
  await check();
  every(check, HOUR);
}
