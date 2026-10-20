// For tests: a fresh database in its own temp DATA_DIR, removed again after the test file.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";
import { type DB, openDatabase } from "./open";

/** A getter for a new database per test, each in a new temp directory. */
export function freshDatabase(dogName = "Toffee"): { db: () => DB; dataDir: () => string } {
  const dirs: string[] = [];
  let current: { db: DB; dir: string };
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "gassi-test-"));
    dirs.push(dir);
    current = { db: await openDatabase(dir, dogName), dir };
    return () => current.db.destroy();
  });
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  return { db: () => current.db, dataDir: () => current.dir };
}
