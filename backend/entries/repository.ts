// The entry table. Newest first everywhere; ties on `at` break by id, so paging is stable.
import { isEntryType } from "../../shared/entryTypes";
import type { DB } from "../db/open";
import type { EntryRow } from "../db/schema";
import type { Entry, EntryFields, NewEntry } from "./model";

export type EntryQuery = {
  dogId: number;
  type?: Entry["type"];
  loggedBy?: string;
  since?: string; // inclusive, ISO
  until?: string; // exclusive, ISO
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
    durationMin: row.duration_min,
    amountG: row.amount_g,
    note: row.note,
    loggedBy: row.logged_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const columns = (f: EntryFields) => ({ at: f.at, duration_min: f.durationMin, amount_g: f.amountG, note: f.note });

export class EntryRepository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(e: NewEntry): Promise<Entry> {
    const stamp = this.now().toISOString();
    const row = await this.db
      .insertInto("entry")
      .values({ dog_id: e.dogId, type: e.type, logged_by: e.loggedBy, ...columns(e), created_at: stamp, updated_at: stamp })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntry(row);
  }

  async get(id: number): Promise<Entry | undefined> {
    const row = await this.db.selectFrom("entry").selectAll().where("id", "=", id).executeTakeFirst();
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
    if (q.since) query = query.where("at", ">=", q.since);
    if (q.until) query = query.where("at", "<", q.until);
    query = query.orderBy("at", "desc").orderBy("id", "desc");
    if (q.limit !== undefined) query = query.limit(q.limit).offset(q.offset ?? 0);
    return (await query.execute()).map(toEntry);
  }
}
