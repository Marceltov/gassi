import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { expect, test } from "vitest";
import { migrate, migrateTo } from "./migrations";
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

test("0.4 keeps a 0.3 database's entries and dogs: no details, no dog marks", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database: new Database(":memory:") }) });
  await migrateTo(db, "0.3_schema");
  await db.insertInto("person").values({ id: "marcel", name: "Hirsch", created_at: "2026-10-20T08:00:00Z" }).execute();
  await db.insertInto("dog").values({ name: "Toffee", color: "#b8691a", created_at: "2026-10-20T08:00:00Z" }).execute();
  await db.insertInto("entry").values({ type: "poop", at: "2026-10-20T09:00:00Z", note: "im Park", logged_by: "marcel", created_at: "2026-10-20T09:00:00Z", updated_at: "2026-10-20T09:00:00Z" }).execute();
  await migrate(db);
  expect(await db.selectFrom("entry").select(["type", "note", "details"]).execute()).toEqual([{ type: "poop", note: "im Park", details: null }]);
  expect(await db.selectFrom("dog").select(["name", "marks"]).execute()).toEqual([{ name: "Toffee", marks: 0 }]);
  await db.destroy();
});

test("0.5 adds walk_recorder and keeps the data", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database: new Database(":memory:") }) });
  await migrateTo(db, "0.4_details_marks");
  await db.insertInto("person").values({ id: "marcel", name: "Hirsch", created_at: "2026-10-20T08:00:00Z" }).execute();
  await db.insertInto("entry").values({ type: "walk", at: "2026-10-20T09:00:00Z", client_key: "w", logged_by: "marcel", created_at: "2026-10-20T09:00:00Z", updated_at: "2026-10-20T09:00:00Z" }).execute();
  await db.insertInto("track").values({ id: "t", entry_id: 1, source: "phone", device_id: null, created_at: "2026-10-20T09:00:00Z" }).execute();
  await migrate(db);
  expect(await db.selectFrom("entry").select(["type", "client_key"]).execute()).toEqual([{ type: "walk", client_key: "w" }]);
  expect(await db.selectFrom("track").select("id").execute()).toEqual([{ id: "t" }]);
  await db.insertInto("walk_recorder").values({ entry_id: 1, device_id: 3, from_at: "2026-10-20T09:00:00Z" }).execute();
  expect(await db.selectFrom("walk_recorder").selectAll().execute()).toEqual([{ entry_id: 1, device_id: 3, from_at: "2026-10-20T09:00:00Z" }]);
  await db.destroy();
});

test("0.7 keeps the treat kinds and offers each in the training", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database: new Database(":memory:") }) });
  await migrateTo(db, "0.6_client_event");
  await db.insertInto("treat_kind").values({ name: "Dentasticks", grams_per_piece: 15, from_dry: 0 }).execute();
  await migrate(db);
  expect(await db.selectFrom("treat_kind").select(["name", "grams_per_piece", "training"]).execute()).toEqual([{ name: "Dentasticks", grams_per_piece: 15, training: 1 }]);
  await db.destroy();
});
