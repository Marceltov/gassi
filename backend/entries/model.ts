// An entry: who did what with which dog, when, with an optional end (walks and trainings; null while one runs), amount
// in grams (food, restocks, weight), food kind, can size (restocks) and note. The input schemas are shared by the
// server actions and the REST API.
import { z } from "zod";
import { ENTRY_TYPES, type EntryType, FOOD_KINDS, type FoodKind, minutesBetween } from "../../shared/entryTypes";

export type Entry = {
  id: number;
  dogId: number;
  type: EntryType;
  at: string; // ISO 8601 UTC
  endedAt: string | null; // ISO 8601 UTC
  durationMin: number | null; // derived from at and endedAt
  amountG: number | null;
  foodKind: FoodKind | null;
  unitG: number | null; // grams per can, on wet-food restocks
  clientKey: string | null; // the key a walk or training was started with
  note: string | null;
  loggedBy: string; // username
  createdAt: string;
  updatedAt: string;
};

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const instant = z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString());

const fieldShape = {
  at: instant,
  endedAt: z.preprocess(blankToNull, instant.nullable()),
  amountG: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000_000).nullable()),
  foodKind: z.preprocess(blankToNull, z.enum(FOOD_KINDS).nullable()),
  unitG: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(10_000).nullable()),
  note: z.preprocess(blankToNull, z.string().trim().max(1000).nullable()).transform((v) => v || null),
};

const endNotBeforeStart = (f: { at: string; endedAt: string | null }) => !f.endedAt || f.endedAt >= f.at;
const endIssue = { message: "end before start", path: ["endedAt"] };

/** The fields a person can set or change; `at` and `endedAt` are ISO instants, the end not before the start. */
export const entryFields = z.object(fieldShape).refine(endNotBeforeStart, endIssue);

export const newEntryInput = z.object({ ...fieldShape, type: z.enum(ENTRY_TYPES) }).refine(endNotBeforeStart, endIssue);

export type EntryFields = z.output<typeof entryFields>;
export type NewEntryInput = z.output<typeof newEntryInput>;
export type NewEntry = NewEntryInput & { dogId: number; loggedBy: string; clientKey?: string | null };

export const durationOf = (e: { at: string; endedAt: string | null }) => minutesBetween(e.at, e.endedAt);

/** The newest entry of each type in `entries`. */
export function latestByType(entries: readonly Entry[]): Partial<Record<EntryType, Entry>> {
  const latest: Partial<Record<EntryType, Entry>> = {};
  for (const e of entries) if (!latest[e.type] || latest[e.type]!.at < e.at) latest[e.type] = e;
  return latest;
}
