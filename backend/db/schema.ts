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
  ended_at: string | null;
  amount_g: number | null;
  food_kind: string | null;
  unit_g: number | null;
  client_key: string | null;
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

export interface WalkWalkerTable {
  entry_id: number;
  username: string;
}

export interface WalkPauseTable {
  id: Generated<number>;
  entry_id: number;
  started_at: string;
  ended_at: string | null;
}

export interface ExerciseTable {
  id: Generated<number>;
  name: string;
  archived: Generated<number>;
}

export interface TrainingExerciseTable {
  entry_id: number;
  exercise_id: number;
}

export interface TreatKindTable {
  id: Generated<number>;
  name: string;
  grams_per_piece: number;
  from_dry: number;
  archived: Generated<number>;
}

export interface TrainingTreatTable {
  entry_id: number;
  treat_kind_id: number;
  count: number;
  grams_per_piece: number; // as when given
  from_dry: number;
}

export interface AppliedCommandTable {
  id: string;
  applied_at: string;
}

export interface SessionAliasTable {
  key: string;
  entry_id: number;
}

export interface Schema {
  dog: DogTable;
  entry: EntryTable;
  person: PersonTable;
  walk_walker: WalkWalkerTable;
  walk_pause: WalkPauseTable;
  exercise: ExerciseTable;
  training_exercise: TrainingExerciseTable;
  treat_kind: TreatKindTable;
  training_treat: TrainingTreatTable;
  applied_command: AppliedCommandTable;
  session_alias: SessionAliasTable;
}

export type EntryRow = Selectable<EntryTable>;
export type NewEntryRow = Insertable<EntryTable>;
export type EntryRowPatch = Updateable<EntryTable>;
