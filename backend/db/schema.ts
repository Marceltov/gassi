// The tables as Kysely sees them. Times are ISO 8601 UTC strings.
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export interface DogTable {
  id: Generated<number>;
  name: string;
  created_at: string;
}

export interface EntryTable {
  id: Generated<number>;
  dog_id: number;
  type: string;
  at: string;
  duration_min: number | null;
  amount_g: number | null;
  note: string | null;
  logged_by: string;
  created_at: ColumnType<string, string, never>;
  updated_at: string;
}

export interface PersonTable {
  username: string;
  name: string;
  updated_at: string;
}

export interface Schema {
  dog: DogTable;
  entry: EntryTable;
  person: PersonTable;
}

export type EntryRow = Selectable<EntryTable>;
export type NewEntryRow = Insertable<EntryTable>;
export type EntryRowPatch = Updateable<EntryTable>;
