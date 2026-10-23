// For tests: a fresh database in its own temp DATA_DIR, removed again after the test file. By default it holds a small
// household (the dog Toffee, id 1; Hirsch = "marcel" and Herzii = "bille"), what most tests log against.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";
import { type DB, openDatabase } from "./open";

export const HIRSCH = { id: "marcel", name: "Hirsch" };
export const HERZII = { id: "bille", name: "Herzii" };
export const TOFFEE = { id: 1, name: "Toffee", color: "#b8691a", archived: false, marks: false };

async function seed(db: DB): Promise<void> {
  const at = "2026-01-01T00:00:00.000Z";
  await db.insertInto("dog").values({ name: TOFFEE.name, color: TOFFEE.color, created_at: at }).execute();
  await db.insertInto("person").values([HIRSCH, HERZII].map((p) => ({ ...p, email: null, oidc_subject: null, created_at: at }))).execute();
}

/** A getter for a new database per test, each in a new temp directory; `empty` leaves out the household. */
export function freshDatabase({ empty = false } = {}): { db: () => DB; dataDir: () => string } {
  const dirs: string[] = [];
  let current: { db: DB; dir: string };
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "gassi-test-"));
    dirs.push(dir);
    current = { db: await openDatabase(dir), dir };
    if (!empty) await seed(current.db);
    return () => current.db.destroy();
  });
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  return { db: () => current.db, dataDir: () => current.dir };
}
