// The entry table. Newest first everywhere; ties on `at` break by id, so paging is stable.
import { type Entry, type EntryFields, isEntryType, isFoodKind, minutesBetween, type NewEntry } from "@gassi/domain";
import type { DB } from "../db/open";
import type { EntryRow } from "../db/schema";

export type EntryQuery = {
  dogId?: number; // only entries about this dog
  type?: Entry["type"];
  by?: string; // only entries this person logged, or walks they went on
  since?: string; // inclusive, ISO
  until?: string; // exclusive, ISO
  overlapping?: boolean; // since/until also take walks and trainings that began earlier and were still on at `since`
  offset?: number;
  limit?: number;
};

function toEntry(row: EntryRow, dogIds: number[]): Entry {
  if (!isEntryType(row.type)) throw new Error(`entry ${row.id} has an unknown type`);
  return {
    id: row.id,
    dogIds,
    type: row.type,
    at: row.at,
    endedAt: row.ended_at,
    durationMin: minutesBetween(row.at, row.ended_at),
    amountG: row.amount_g,
    foodKind: isFoodKind(row.food_kind) ? row.food_kind : null,
    unitG: row.unit_g,
    clientKey: row.client_key,
    note: row.note,
    loggedBy: row.logged_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const columns = (f: EntryFields) => ({ at: f.at, ended_at: f.endedAt, amount_g: f.amountG, food_kind: f.foodKind, unit_g: f.unitG, note: f.note });

export class EntryRepository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The entry and its dogs, together (inside the caller's transaction if there is one). */
  async create(e: NewEntry): Promise<Entry> {
    const stamp = this.now().toISOString();
    const insert = async (db: DB) => {
      const row = await db
        .insertInto("entry")
        .values({ type: e.type, logged_by: e.loggedBy, client_key: e.clientKey ?? null, ...columns(e), created_at: stamp, updated_at: stamp })
        .returningAll()
        .executeTakeFirstOrThrow();
      const dogIds = [...new Set(e.dogIds)];
      if (dogIds.length) await db.insertInto("entry_dog").values(dogIds.map((dog_id) => ({ entry_id: row.id, dog_id }))).execute();
      return toEntry(row, dogIds.sort((a, b) => a - b));
    };
    return this.db.isTransaction ? insert(this.db) : this.db.transaction().execute(insert);
  }

  async get(id: number): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("id", "=", id).executeTakeFirst();
    return this.one(row);
  }

  /** The newest walk or training that was started with a key and has not ended (one logged afterwards without an end is a moment, not running). */
  async running(type: "walk" | "training"): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("type", "=", type).where("ended_at", "is", null).where("client_key", "is not", null).orderBy("at", "desc").orderBy("id", "desc").executeTakeFirst();
    return this.one(row);
  }

  async byClientKey(key: string): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("client_key", "=", key).executeTakeFirst();
    return this.one(row);
  }

  /** Changes the fields, and the dogs when `fields.dogIds` is given. */
  async update(id: number, fields: EntryFields): Promise<Entry | undefined> {
    const change = async (db: DB) => {
      const row = await db.updateTable("entry").set({ ...columns(fields), updated_at: this.now().toISOString() }).where("id", "=", id).returningAll().executeTakeFirst();
      if (row && fields.dogIds) {
        await db.deleteFrom("entry_dog").where("entry_id", "=", id).execute();
        const dogIds = [...new Set(fields.dogIds)];
        if (dogIds.length) await db.insertInto("entry_dog").values(dogIds.map((dog_id) => ({ entry_id: id, dog_id }))).execute();
      }
      return row;
    };
    return this.one(await (this.db.isTransaction ? change(this.db) : this.db.transaction().execute(change)));
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("entry").where("id", "=", id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async list(q: EntryQuery): Promise<Entry[]> {
    let query = this.db.selectFrom("entry").selectAll();
    if (q.dogId !== undefined) {
      const dogId = q.dogId;
      query = query.where((eb) => eb.exists(eb.selectFrom("entry_dog").select("entry_dog.entry_id").whereRef("entry_dog.entry_id", "=", "entry.id").where("entry_dog.dog_id", "=", dogId)));
    }
    if (q.type) query = query.where("type", "=", q.type);
    if (q.by) {
      const by = q.by;
      query = query.where((eb) => eb.or([eb("logged_by", "=", by), eb.exists(eb.selectFrom("walk_walker").select("walk_walker.entry_id").whereRef("walk_walker.entry_id", "=", "entry.id").where("walk_walker.person_id", "=", by))]));
    }
    if (q.since && q.overlapping) {
      const since = q.since;
      // at or after `since`; or begun before and ended after it, or still running (started with a key, no end)
      query = query.where((eb) => eb.or([eb("at", ">=", since), eb("ended_at", ">", since), eb.and([eb("ended_at", "is", null), eb("client_key", "is not", null)])]));
    } else if (q.since) query = query.where("at", ">=", q.since);
    if (q.until) query = query.where("at", "<", q.until);
    query = query.orderBy("at", "desc").orderBy("id", "desc");
    if (q.limit !== undefined) query = query.limit(q.limit).offset(q.offset ?? 0);
    return this.withDogs(await query.execute());
  }

  // Each row with the dogs it is about, read in one query.
  private async withDogs(rows: EntryRow[]): Promise<Entry[]> {
    if (rows.length === 0) return [];
    const links = await this.db.selectFrom("entry_dog").select(["entry_id", "dog_id"]).where("entry_id", "in", rows.map((r) => r.id)).orderBy("dog_id").execute();
    const dogs = new Map<number, number[]>();
    for (const l of links) dogs.set(l.entry_id, [...(dogs.get(l.entry_id) ?? []), l.dog_id]);
    return rows.map((r) => toEntry(r, dogs.get(r.id) ?? []));
  }

  private async one(row: EntryRow | undefined): Promise<Entry | undefined> {
    return row && (await this.withDogs([row]))[0];
  }
}
