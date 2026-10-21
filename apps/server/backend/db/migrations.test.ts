import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { DB_FILE, openDatabase } from "./open";

test("a database from Gassi 0.2 is refused with what to do, not run on the old tables", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gassi-old-"));
  const old = new Database(join(dir, DB_FILE));
  old.exec(`create table kysely_migration (name varchar(255) not null primary key, timestamp varchar(255) not null);
            insert into kysely_migration values ('001_schema', '2026-10-20T16:00:00.000Z');
            create table person (username text primary key, name text not null, updated_at text not null);`);
  old.close();
  await expect(openDatabase(dir)).rejects.toThrow(/older Gassi.*move .*gassi\.db/i);
});

test("a fresh database gets the current schema and opens again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gassi-new-"));
  await (await openDatabase(dir)).destroy();
  const db = await openDatabase(dir);
  expect(await db.selectFrom("device").selectAll().execute()).toEqual([]);
  await db.destroy();
});
