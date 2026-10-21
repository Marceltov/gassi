// Opens ${DATA_DIR}/gassi.db (WAL) and brings the schema up to date. database() is the one connection of the process,
// opened on first use (instrumentation.ts asks for it at startup); openDatabase() is for tests.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect, sql } from "kysely";
import { config } from "../config";
import { processState } from "../state";
import { migrate } from "./migrations";
import type { Schema } from "./schema";

export type DB = Kysely<Schema>;

export const DB_FILE = "gassi.db";

export async function openDatabase(dataDir: string): Promise<DB> {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, DB_FILE));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = new Kysely<Schema>({ dialect: new SqliteDialect({ database: sqlite }) });
  await migrate(db);
  return db;
}

const state = processState("db", () => ({ db: undefined as Promise<DB> | undefined }));

export function database(): Promise<DB> {
  if (!state.db) {
    state.db = openDatabase(config().dataDir);
    state.db.catch(() => (state.db = undefined)); // the next call tries again
  }
  return state.db;
}

/** Resolves when the database answers `select 1`, rejects otherwise. */
export async function ping(db: DB): Promise<void> {
  await sql`select 1`.execute(db);
}
