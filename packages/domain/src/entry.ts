// An entry: who did what with which dog, when, with an optional end (walks and trainings; null while one runs), amount
// in grams (food, restocks, weight), food kind, can size (restocks), note and the details only some kinds have (a
// poop's consistency). The input schemas are shared by the server and its clients.
import { z } from "zod";
import { ATTENTIONS, DISTANCES, HANDLINGS, MOODS, PLACES, REACTION_MAX, SCALE_MAX, SCALE_MIN } from "./encounters";
import { CONSISTENCIES, ENTRY_TYPES, type EntryType, FOOD_KINDS, type FoodKind, minutesBetween } from "./entryTypes";

export type Entry = {
  id: number;
  dogIds: number[]; // the dogs it is about (none for restocks, stock counts and notes)
  type: EntryType;
  at: string; // ISO 8601 UTC
  endedAt: string | null; // ISO 8601 UTC
  durationMin: number | null; // derived from at and endedAt
  amountG: number | null;
  foodKind: FoodKind | null;
  unitG: number | null; // grams per can, on wet-food restocks
  clientKey: string | null; // the key a walk or training was started with
  note: string | null;
  details: EntryDetails | null;
  loggedBy: string; // person id
  createdAt: string;
  updatedAt: string;
};

const scale = z.number().int().min(SCALE_MIN).max(SCALE_MAX);
/** What only some kinds of entries have, each optional here: a poop's consistency (#86), a dog encounter's reaction,
 * attention, handling and distance (#37), a person encounter's who, place, rating, moods, growling and insecurity
 * (#90). Kept as one JSON column (ADR 0013). */
export const entryDetails = z
  .object({
    consistency: z.enum(CONSISTENCIES).optional(),
    reaction: z.number().int().min(0).max(REACTION_MAX).optional(),
    attention: z.enum(ATTENTIONS).optional(),
    handling: z.enum(HANDLINGS).optional(),
    distance: z.enum(DISTANCES).optional(),
    who: z.string().trim().min(1).max(60).optional(),
    place: z.enum(PLACES).optional(),
    rating: scale.optional(),
    moods: z.array(z.enum(MOODS)).max(MOODS.length).optional(),
    growled: z.boolean().optional(),
    insecurity: scale.optional(),
  })
  .strict();
export type EntryDetails = z.output<typeof entryDetails>;
type Detail = keyof EntryDetails;
/** The kinds that may have each detail. */
const DETAIL_TYPES: Record<Detail, readonly EntryType[]> = {
  consistency: ["poop"],
  reaction: ["dogEncounter"],
  attention: ["dogEncounter"],
  handling: ["dogEncounter"],
  distance: ["dogEncounter"],
  who: ["personEncounter"],
  place: ["personEncounter"],
  rating: ["personEncounter"],
  moods: ["personEncounter"],
  growled: ["personEncounter"],
  insecurity: ["personEncounter"],
};
/** What a kind can't be without, with what to ask. */
const NEEDED: Partial<Record<EntryType, [Detail, string][]>> = {
  dogEncounter: [["reaction", "Wie stark hat er reagiert?"]],
  personEncounter: [
    ["who", "Wen habt ihr getroffen?"],
    ["rating", "Wie lief es?"],
  ],
};

/** A German message when `details` has one `type` can't have, or lacks one it needs; else null. */
export function checkDetails(type: EntryType, details: EntryDetails | null): string | null {
  const wrong = Object.keys(details ?? {}).find((k) => !DETAIL_TYPES[k as Detail].includes(type));
  if (wrong) return "Das passt nicht zu dieser Art von Eintrag.";
  return NEEDED[type]?.find(([k]) => details?.[k] === undefined)?.[1] ?? null;
}

/** `details` with `key` set to `value`, or taken out for null; none left is null. */
export function withDetail<K extends keyof EntryDetails>(details: EntryDetails | null, key: K, value: EntryDetails[K] | null): EntryDetails | null {
  const next: EntryDetails = { ...details, [key]: value ?? undefined };
  if (value === null) delete next[key];
  return Object.keys(next).length ? next : null;
}

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const instant = z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString());

// An optional field: left out, empty or null all mean null (the key may be left out by callers).
const optionalField = <T extends z.ZodType>(s: T) =>
  z
    .preprocess(blankToNull, s.nullable())
    .optional()
    .transform((v) => (v ?? null) as z.output<T> | null);

const fieldShape = {
  dogIds: z.array(z.number().int().positive()).max(20).optional(),
  at: instant,
  endedAt: optionalField(instant),
  amountG: optionalField(z.coerce.number().int().min(0).max(1_000_000)), // 0: a stock counted empty
  foodKind: optionalField(z.enum(FOOD_KINDS)),
  unitG: optionalField(z.coerce.number().int().min(1).max(10_000)),
  note: optionalField(z.string().trim().max(1000)).transform((v) => v || null),
  // nothing set is null
  details: optionalField(entryDetails).transform((v) => (v && Object.values(v).some((x) => x !== undefined) ? v : null)),
};

const endNotBeforeStart = (f: { at: string; endedAt: string | null }) => !f.endedAt || f.endedAt >= f.at;
const endIssue = { message: "end before start", path: ["endedAt"] };

/** The fields a person can set or change; `at` and `endedAt` are ISO instants, the end not before the start. */
export const entryFields = z.object(fieldShape).refine(endNotBeforeStart, endIssue);

export const newEntryInput = z.object({ ...fieldShape, type: z.enum(ENTRY_TYPES) }).refine(endNotBeforeStart, endIssue);

// What the API takes: a new entry whose time defaults to now, and an edit of the entry with `id`.
const endIfBoth = (f: { at?: string; endedAt: string | null }) => !f.at || endNotBeforeStart({ at: f.at, endedAt: f.endedAt });
export const entryCreateInput = z.object({ ...fieldShape, at: instant.optional(), type: z.enum(ENTRY_TYPES) }).refine(endIfBoth, endIssue);
// An edit may also replace a walk's walkers (person ids; at least one).
const editShape = { ...fieldShape, walkers: z.array(z.string().min(1)).min(1).max(20).optional() };
export const entryEditFields = z.object(editShape).refine(endNotBeforeStart, endIssue);
export const entryEditInput = z.object({ ...editShape, id: z.coerce.number().int().positive() }).refine(endNotBeforeStart, endIssue);

const count = z.number().int().min(0).max(10_000);
/** Replaces a training's repetitions (per exercise and dog) and treats (per kind) afterwards. */
export const trainingEditInput = z.object({
  id: z.coerce.number().int().positive(),
  reps: z.array(z.object({ exerciseId: z.number().int().positive(), dogId: z.number().int().positive(), ok: count, fail: count })).max(500),
  treats: z.array(z.object({ treatKindId: z.number().int().positive(), count })).max(100),
});

/** The German message for each field of an entry, shown when it doesn't fit. */
export const ENTRY_MESSAGES: Record<string, string> = {
  at: "Die Zeit fehlt oder stimmt nicht.",
  endedAt: "Das Ende fehlt, stimmt nicht oder liegt vor dem Anfang.",
  amountG: "Die Menge muss eine ganze Zahl Gramm sein.",
  foodKind: "Diese Futterart gibt es nicht.",
  unitG: "Die Dosengröße muss eine ganze Zahl Gramm sein (1 bis 10000).",
  note: "Die Notiz ist zu lang (höchstens 1000 Zeichen).",
  details: "Diese Angabe gibt es nicht.",
  type: "Diese Art von Eintrag gibt es nicht.",
  dogIds: "Diesen Hund gibt es nicht.",
  walkers: "Eine Runde braucht mindestens einen Mitgeher.",
  reps: "Die Wiederholungen stimmen nicht.",
  treats: "Die Leckerli stimmen nicht.",
};

export type EntryFields = z.output<typeof entryFields>;
export type NewEntryInput = z.output<typeof newEntryInput>;
// details left out are none (a new entry) or unchanged (an update)
export type NewEntry = Omit<NewEntryInput, "dogIds" | "details"> & { dogIds: number[]; loggedBy: string; clientKey?: string | null; details?: EntryDetails | null };
export type EntryPatch = Omit<EntryFields, "details"> & { details?: EntryDetails | null };

export const durationOf = (e: { at: string; endedAt: string | null }) => minutesBetween(e.at, e.endedAt);
