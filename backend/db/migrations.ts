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
  // Who has signed in, with the display name authentik last gave: the names shown for entries and in the filters.
  "002_person": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("person")
        .addColumn("username", "text", (c) => c.primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();
    },
  },
  // v1.1: walks and trainings run from `at` to `ended_at` (null while running) and carry the client's key; food has a
  // kind; restocks of cans record the can size. The duration is derived from the two times now. Pauses, walkers,
  // exercises and treats hang off an entry. `applied_command` makes walk taps idempotent; `session_alias` maps the key
  // of a second "start" (both people at the door) to the walk that was already running.
  "003_walks_training_food": {
    async up(db: Kysely<any>) {
      await db.schema.alterTable("entry").addColumn("ended_at", "text").execute();
      await db.schema.alterTable("entry").addColumn("food_kind", "text").execute();
      await db.schema.alterTable("entry").addColumn("client_key", "text").execute();
      await db.schema.alterTable("entry").addColumn("unit_g", "integer").execute();
      await db.schema.alterTable("entry").dropColumn("duration_min").execute();
      await db.schema.createIndex("entry_by_client_key").unique().on("entry").column("client_key").execute();
      const byEntry = (c: any) => c.notNull().references("entry.id").onDelete("cascade");
      await db.schema
        .createTable("walk_walker")
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("username", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("walk_walker_pk", ["entry_id", "username"])
        .execute();
      await db.schema
        .createTable("walk_pause")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("started_at", "text", (c) => c.notNull())
        .addColumn("ended_at", "text")
        .execute();
      await db.schema
        .createTable("exercise")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "text", (c) => c.notNull().unique())
        .addColumn("archived", "integer", (c) => c.notNull().defaultTo(0))
        .execute();
      await db.schema
        .createTable("training_exercise")
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("exercise_id", "integer", (c) => c.notNull().references("exercise.id").onDelete("cascade"))
        .addPrimaryKeyConstraint("training_exercise_pk", ["entry_id", "exercise_id"])
        .execute();
      await db.schema
        .createTable("treat_kind")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "text", (c) => c.notNull().unique())
        .addColumn("grams_per_piece", "real", (c) => c.notNull())
        .addColumn("from_dry", "integer", (c) => c.notNull())
        .addColumn("archived", "integer", (c) => c.notNull().defaultTo(0))
        .execute();
      await db.schema
        .createTable("training_treat")
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("treat_kind_id", "integer", (c) => c.notNull().references("treat_kind.id").onDelete("cascade"))
        .addColumn("count", "integer", (c) => c.notNull())
        // what one piece weighed and whether it came out of the dry food when given, so later changes to the kind
        // don't rewrite the stock
        .addColumn("grams_per_piece", "real", (c) => c.notNull())
        .addColumn("from_dry", "integer", (c) => c.notNull())
        .addPrimaryKeyConstraint("training_treat_pk", ["entry_id", "treat_kind_id"])
        .execute();
      await db.schema
        .createTable("applied_command")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("applied_at", "text", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("session_alias")
        .addColumn("key", "text", (c) => c.primaryKey())
        .addColumn("entry_id", "integer", byEntry)
        .execute();
    },
  },
};

const provider: MigrationProvider = { getMigrations: async () => migrations };

export async function migrate(db: Kysely<any>): Promise<void> {
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest();
  const failed = results?.find((r) => r.status === "Error");
  if (error) throw new Error(`migration ${failed?.migrationName ?? "(unknown)"} failed`, { cause: error });
}
