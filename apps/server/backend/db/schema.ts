// The tables as Kysely sees them. Times are ISO 8601 UTC strings.
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export interface DogTable {
  id: Generated<number>;
  name: string;
  color: string; // #rrggbb
  archived: Generated<number>;
  created_at: string;
}

export interface EntryTable {
  id: Generated<number>;
  type: string;
  at: string;
  ended_at: string | null;
  amount_g: number | null;
  food_kind: string | null;
  unit_g: number | null;
  client_key: string | null;
  note: string | null;
  logged_by: string; // person.id
  created_at: ColumnType<string, string, never>;
  updated_at: string;
}

export interface PersonTable {
  id: string;
  name: string;
  email: string | null;
  oidc_subject: string | null;
  created_at: string;
}

export interface DeviceTable {
  id: Generated<number>;
  person_id: string;
  kind: string; // phone | watch | web | script
  name: string;
  token_hash: string;
  created_at: string;
  last_seen_at: string | null;
}

export interface LinkTable {
  id: Generated<number>;
  token_hash: string;
  kind: string; // setup | person | device | watch | magic
  person_id: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export interface EntryDogTable {
  entry_id: number;
  dog_id: number;
}

export interface WalkWalkerTable {
  entry_id: number;
  person_id: string;
}

export interface TrackTable {
  id: string; // the recording device's id for it
  entry_id: number;
  source: string; // phone | watch
  device_id: number | null;
  created_at: string;
}

export interface TrackBatchTable {
  track_id: string;
  seq: number;
  points: string; // JSON TrackPoint[]
  received_at: string;
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
  dog_id: number;
  ok_count: Generated<number>;
  fail_count: Generated<number>;
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
  device: DeviceTable;
  link: LinkTable;
  entry_dog: EntryDogTable;
  track: TrackTable;
  track_batch: TrackBatchTable;
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
