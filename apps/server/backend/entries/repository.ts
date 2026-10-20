// The entry table. Newest first everywhere; ties on `at` break by id, so paging is stable.
import { type Entry, type EntryFields, isEntryType, isFoodKind, minutesBetween, type NewEntry } from "@gassi/domain";
import type { DB } from "../db/open";
import type { EntryRow } from "../db/schema";

export type EntryQuery = {
  dogId: number;
  type?: Entry["type"];
  loggedBy?: string;
  since?: string; // inclusive, ISO
  until?: string; // exclusive, ISO
  overlapping?: boolean; // since/until also take walks and trainings that began earlier and were still on at `since`
  offset?: number;
  limit?: number;
};

function toEntry(row: EntryRow): Entry {
  if (!isEntryType(row.type)) throw new Error(`entry ${row.id} has an unknown type`);
  return {
    id: row.id,
    dogId: row.dog_id,
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

  async create(e: NewEntry): Promise<Entry> {
    const stamp = this.now().toISOString();
    const row = await this.db
      .insertInto("entry")
      .values({ dog_id: e.dogId, type: e.type, logged_by: e.loggedBy, client_key: e.clientKey ?? null, ...columns(e), created_at: stamp, updated_at: stamp })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntry(row);
  }

  async get(id: number): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("id", "=", id).executeTakeFirst();
    return row && toEntry(row);
  }

  /** The newest walk or training that was started with a key and has not ended (one logged afterwards without an end is a moment, not running). */
  async running(type: "walk" | "training"): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("type", "=", type).where("ended_at", "is", null).where("client_key", "is not", null).orderBy("at", "desc").orderBy("id", "desc").executeTakeFirst();
    return row && toEntry(row);
  }

  async byClientKey(key: string): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("client_key", "=", key).executeTakeFirst();
    return row && toEntry(row);
  }

  async update(id: number, fields: EntryFields): Promise<Entry | undefined> {
    const row = await this.db
      .updateTable("entry")
      .set({ ...columns(fields), updated_at: this.now().toISOString() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row && toEntry(row);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("entry").where("id", "=", id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async list(q: EntryQuery): Promise<Entry[]> {
    let query = this.db.selectFrom("entry").selectAll().where("dog_id", "=", q.dogId);
    if (q.type) query = query.where("type", "=", q.type);
    if (q.loggedBy) query = query.where("logged_by", "=", q.loggedBy);
    if (q.since && q.overlapping) {
      const since = q.since;
      // at or after `since`; or begun before and ended after it, or still running (started with a key, no end)
      query = query.where((eb) => eb.or([eb("at", ">=", since), eb("ended_at", ">", since), eb.and([eb("ended_at", "is", null), eb("client_key", "is not", null)])]));
    } else if (q.since) query = query.where("at", ">=", q.since);
    if (q.until) query = query.where("at", "<", q.until);
    query = query.orderBy("at", "desc").orderBy("id", "desc");
    if (q.limit !== undefined) query = query.limit(q.limit).offset(q.offset ?? 0);
    return (await query.execute()).map(toEntry);
  }
}
