import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { backupIfDue, startBackups } from "./backup";
import { freshDatabase } from "./db/testing";
import { EntryRepository } from "./entries/repository";

const { db } = freshDatabase();
const TZ = "Europe/Berlin";
const dir = () => mkdtempSync(join(tmpdir(), "gassi-backup-"));

test("writes today's copy once", async () => {
  const d = dir();
  const now = Date.parse("2026-10-20T22:30:00Z"); // already the 21st in Berlin
  expect(await backupIfDue(db(), d, now, TZ)).toBe(join(d, "gassi-2026-10-21.db"));
  expect(await backupIfDue(db(), d, now + 3_600_000, TZ)).toBeNull();
  expect(readdirSync(d)).toEqual(["gassi-2026-10-21.db"]);
});

test("keeps 14", async () => {
  const d = dir();
  for (let day = 1; day <= 15; day++) writeFileSync(join(d, `gassi-2026-09-${String(day).padStart(2, "0")}.db`), "");
  writeFileSync(join(d, "notes.txt"), "not a backup");
  await backupIfDue(db(), d, Date.parse("2026-10-20T10:00:00Z"), TZ);
  const left = readdirSync(d).sort();
  expect(left.filter((f) => f.startsWith("gassi-"))).toHaveLength(14);
  expect(left).toContain("gassi-2026-10-20.db");
  expect(left).not.toContain("gassi-2026-09-02.db");
  expect(left).toContain("gassi-2026-09-03.db");
  expect(left).toContain("notes.txt");
});

test("the copy opens and has the entries", async () => {
  await new EntryRepository(db()).create({ dogIds: [1], type: "pee", at: "2026-10-20T09:00:00.000Z", endedAt: null, amountG: null, foodKind: null, unitG: null, note: "im Backup", loggedBy: "marcel" });
  const d = join(dir(), "backups"); // created when missing
  const path = (await backupIfDue(db(), d, Date.parse("2026-10-20T10:00:00Z"), TZ))!;
  expect(existsSync(path)).toBe(true);
  const copy = new Database(path, { readonly: true });
  expect(copy.prepare("select note from entry").all()).toEqual([{ note: "im Backup" }]);
  copy.close();
});

test("startBackups checks right away and then every hour, and logs a failure instead of throwing", async () => {
  const d = dir();
  let tick: (() => void) | undefined;
  let every = 0;
  const errors: unknown[] = [];
  let now = Date.parse("2026-10-20T10:00:00Z");
  await startBackups({ db: db(), dir: d, timeZone: TZ, now: () => now, every: (fn, ms) => ((tick = fn), (every = ms)), onError: (e) => errors.push(e) });
  expect(every).toBe(3_600_000);
  expect(readdirSync(d)).toEqual(["gassi-2026-10-20.db"]);
  now += 86_400_000;
  await tick!();
  expect(readdirSync(d).sort()).toEqual(["gassi-2026-10-20.db", "gassi-2026-10-21.db"]);
  await db().destroy(); // the next copy fails
  now += 86_400_000;
  await tick!();
  expect(errors).toHaveLength(1);
});

test("writes under a temporary name and renames, so a half-written copy never counts; a leftover one is replaced", async () => {
  const d = dir();
  writeFileSync(join(d, ".gassi-2026-10-20.db.tmp"), "half a database");
  expect(await backupIfDue(db(), d, Date.parse("2026-10-20T10:00:00Z"), TZ)).toBe(join(d, "gassi-2026-10-20.db"));
  expect(readdirSync(d)).toEqual(["gassi-2026-10-20.db"]);
});
