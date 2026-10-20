// Schema changes, in order. Never edit one that has shipped; add the next. Kept in code, not files, so the standalone
// build has nothing extra to trace. Kysely's Migrator records what ran in `kysely_migration`.
// The migrations run against whatever the schema was when they were written, so the database is untyped here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Kysely, sql } from "kysely";
import { type Migration, type MigrationProvider, Migrator } from "kysely/migration";

const migrations: Record<string, Migration> = {
  "001_dog_and_entry": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("dog")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("entry")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("dog_id", "integer", (c) => c.notNull().references("dog.id").onDelete("cascade"))
        .addColumn("type", "text", (c) => c.notNull())
        .addColumn("at", "text", (c) => c.notNull())
        .addColumn("duration_min", "integer")
        .addColumn("amount_g", "integer")
        .addColumn("note", "text")
        .addColumn("logged_by", "text", (c) => c.notNull())
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("entry_by_dog_and_time").on("entry").columns(["dog_id", sql`at desc` as any]).execute();
    },
  },
};

const provider: MigrationProvider = { getMigrations: async () => migrations };

export async function migrate(db: Kysely<any>): Promise<void> {
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest();
  const failed = results?.find((r) => r.status === "Error");
  if (error) throw new Error(`migration ${failed?.migrationName ?? "(unknown)"} failed`, { cause: error });
}
