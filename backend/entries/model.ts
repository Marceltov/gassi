// An entry: who did what with which dog, when, with an optional duration (walks), amount (food) and note. The input
// schemas are shared by the server actions and the REST API.
import { z } from "zod";
import { ENTRY_TYPES, type EntryType } from "../../shared/entryTypes";

export type Entry = {
  id: number;
  dogId: number;
  type: EntryType;
  at: string; // ISO 8601 UTC
  durationMin: number | null;
  amountG: number | null;
  note: string | null;
  loggedBy: string; // username
  createdAt: string;
  updatedAt: string;
};

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/** The fields a person can set or change; `at` is an ISO instant. */
export const entryFields = z.object({
  at: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
  durationMin: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(24 * 60).nullable()),
  amountG: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(10_000).nullable()),
  note: z.preprocess(blankToNull, z.string().trim().max(1000).nullable()).transform((v) => v || null),
});

export const newEntryInput = entryFields.extend({ type: z.enum(ENTRY_TYPES) });

export type EntryFields = z.output<typeof entryFields>;
export type NewEntryInput = z.output<typeof newEntryInput>;
export type NewEntry = NewEntryInput & { dogId: number; loggedBy: string };

/** The newest entry of each type in `entries`. */
export function latestByType(entries: readonly Entry[]): Partial<Record<EntryType, Entry>> {
  const latest: Partial<Record<EntryType, Entry>> = {};
  for (const e of entries) if (!latest[e.type] || latest[e.type]!.at < e.at) latest[e.type] = e;
  return latest;
}
