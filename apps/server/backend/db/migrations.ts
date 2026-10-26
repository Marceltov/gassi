// Schema changes, in order. Never edit one that has shipped; add the next. Kept in code, not files, so the standalone
// build has nothing extra to trace. Kysely's Migrator records what ran in `kysely_migration`.
// The migrations run against whatever the schema was when they were written, so the database is untyped here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Kysely, sql } from "kysely";
import { type Migration, type MigrationProvider, Migrator } from "kysely/migration";

const migrations: Record<string, Migration> = {
  // The whole schema as of 0.3 (the rebuild for apps; nothing held real data before, so it starts over). A household
  // has dogs and people; each person signs in on devices with tokens that came from one-time links. Everything that
  // happens is an entry for one or more dogs (walks and trainings run from `at` to `ended_at`, null while running, and
  // carry the key the phone started them with); walkers, pauses, exercises, treats and GPS tracks hang off an entry.
  // `applied_command` makes taps idempotent; `session_alias` maps the key of a second "start" to the running walk.
  // Named 0.3_schema: 0.2 called its only migration "001_schema", and its databases must not pass for this one.
  "0.3_schema": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("dog")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("color", "text", (c) => c.notNull())
        .addColumn("archived", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("person")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("email", "text", (c) => c.unique())
        .addColumn("oidc_subject", "text", (c) => c.unique())
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("device")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("person_id", "text", (c) => c.notNull().references("person.id").onDelete("cascade"))
        .addColumn("kind", "text", (c) => c.notNull())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("token_hash", "text", (c) => c.notNull().unique())
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("last_seen_at", "text")
        .execute();
      await db.schema
        .createTable("link")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("token_hash", "text", (c) => c.notNull().unique())
        .addColumn("code_hash", "text", (c) => c.unique())
        .addColumn("kind", "text", (c) => c.notNull())
        .addColumn("person_id", "text", (c) => c.references("person.id").onDelete("cascade"))
        .addColumn("created_by", "text", (c) => c.references("person.id").onDelete("set null"))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("expires_at", "text", (c) => c.notNull())
        .addColumn("used_at", "text")
        .addColumn("revoked_at", "text")
        .execute();
      await db.schema
        .createTable("entry")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("type", "text", (c) => c.notNull())
        .addColumn("at", "text", (c) => c.notNull())
        .addColumn("ended_at", "text")
        .addColumn("amount_g", "integer")
        .addColumn("food_kind", "text")
        .addColumn("unit_g", "integer")
        .addColumn("client_key", "text")
        .addColumn("note", "text")
        .addColumn("logged_by", "text", (c) => c.notNull().references("person.id"))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("entry_by_time").on("entry").columns([sql`at desc` as any]).execute();
      await db.schema.createIndex("entry_by_client_key").unique().on("entry").column("client_key").execute();
      const byEntry = (c: any) => c.notNull().references("entry.id").onDelete("cascade");
      await db.schema
        .createTable("entry_dog")
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("dog_id", "integer", (c) => c.notNull().references("dog.id"))
        .addPrimaryKeyConstraint("entry_dog_pk", ["entry_id", "dog_id"])
        .execute();
      await db.schema.createIndex("entry_dog_by_dog").on("entry_dog").columns(["dog_id"]).execute();
      await db.schema
        .createTable("walk_walker")
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("person_id", "text", (c) => c.notNull().references("person.id"))
        .addPrimaryKeyConstraint("walk_walker_pk", ["entry_id", "person_id"])
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
        .addColumn("dog_id", "integer", (c) => c.notNull().references("dog.id"))
        .addColumn("ok_count", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("fail_count", "integer", (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("training_exercise_pk", ["entry_id", "exercise_id", "dog_id"])
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
      await db.schema
        .createTable("track")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("entry_id", "integer", byEntry)
        .addColumn("source", "text", (c) => c.notNull())
        .addColumn("device_id", "integer", (c) => c.references("device.id").onDelete("set null"))
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("track_batch")
        .addColumn("track_id", "text", (c) => c.notNull().references("track.id").onDelete("cascade"))
        .addColumn("seq", "integer", (c) => c.notNull())
        .addColumn("points", "text", (c) => c.notNull())
        .addColumn("received_at", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("track_batch_pk", ["track_id", "seq"])
        .execute();
    },
  },
  // The first change to a database with real data (2026-10-23): entries get `details` (JSON of what only some kinds
  // have, a poop's consistency first, #86) and dogs `marks` (the walk offers "Markiert" for them, #38). Both are new
  // columns with empty defaults, so every row stays as it was.
  "0.4_details_marks": {
    async up(db: Kysely<any>) {
      await db.schema.alterTable("entry").addColumn("details", "text").execute();
      await db.schema.alterTable("dog").addColumn("marks", "integer", (c) => c.notNull().defaultTo(0)).execute();
    },
  },
  // Who records a walk's route from when (#104, ADR 0014): a new table, so every row stays as it was.
  "0.5_walk_recorder": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("walk_recorder")
        .addColumn("entry_id", "integer", (c) => c.notNull().references("entry.id").onDelete("cascade"))
        .addColumn("device_id", "integer", (c) => c.notNull())
        .addColumn("from_at", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("walk_recorder_pk", ["entry_id", "from_at"])
        .execute();
    },
  },
  // What happens in the app, kept 30 days (#115): a new table, so every row stays as it was.
  "0.6_client_event": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("client_event")
        .addColumn("device_id", "integer", (c) => c.notNull())
        .addColumn("id", "text", (c) => c.notNull())
        .addColumn("person_id", "text", (c) => c.notNull())
        .addColumn("at", "text", (c) => c.notNull())
        .addColumn("kind", "text", (c) => c.notNull())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("data", "text")
        .addColumn("version", "text", (c) => c.notNull())
        .addColumn("platform", "text", (c) => c.notNull())
        .addColumn("received_at", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("client_event_pk", ["device_id", "id"])
        .execute();
      await db.schema.createIndex("client_event_received").on("client_event").column("received_at").execute();
    },
  },
  // Which treats the training offers (#126: some stay at home): a new column, on for every kind, so the training
  // offers what it offered before.
  "0.7_treat_training": {
    async up(db: Kysely<any>) {
      await db.schema.alterTable("treat_kind").addColumn("training", "integer", (c) => c.notNull().defaultTo(1)).execute();
    },
  },
};

const provider: MigrationProvider = { getMigrations: async () => migrations };

/** For tests: the schema as it was after migration `name`, to check that the next ones keep the data. */
export async function migrateTo(db: Kysely<any>, name: string): Promise<void> {
  const { error } = await new Migrator({ db, provider }).migrateTo(name);
  if (error) throw error;
}

/** Thrown for a database whose recorded migrations this version doesn't know (made by an older Gassi before 0.3). */
export class OldDatabaseError extends Error {}

export async function migrate(db: Kysely<any>): Promise<void> {
  const done = await sql<{ name: string }>`select name from kysely_migration`.execute(db).then(
    (r) => r.rows.map((row) => row.name),
    () => [] as string[], // a fresh database has no migration table yet
  );
  const unknown = done.filter((name) => !(name in migrations));
  if (unknown.length)
    throw new OldDatabaseError(`gassi.db was made by an older Gassi (migrations ${unknown.join(", ")}) and can't be migrated: stop Gassi, move gassi.db, gassi.db-wal and gassi.db-shm out of the data folder (to keep them), and start again to set up afresh.`);
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest();
  const failed = results?.find((r) => r.status === "Error");
  if (error) throw new Error(`migration ${failed?.migrationName ?? "(unknown)"} failed`, { cause: error });
}
