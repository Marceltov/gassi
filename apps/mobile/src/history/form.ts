// An entry's detail as a form, and what it sends: an edit carries every field (a left-out note or amount would become
// empty), walkers only for a walk; a training's repetitions and treats go in their own call and replace what it had; a
// wet count's other rows (one entry per can size) go as edits of their own, those whose cans changed.
import type { Input, Output } from "@gassi/api-client";
import { cansOf, dogRule, type EntryType, keepsOne } from "@gassi/domain";

export type Entry = Output<"entry">;
type Rep = Entry["reps"][number];
type TreatCount = Entry["treatCounts"][number];
type CountRow = { id: number; unitG: number; cans: number };

export type Form = {
  at: string;
  endedAt: string | null;
  dogIds: number[];
  walkerIds: string[];
  amountG: number | null;
  foodKind: Entry["foodKind"];
  unitG: number | null; // an opened can's size
  count: CountRow[]; // a wet count's closed cans per size
  note: string;
  details: Entry["details"]; // a poop's consistency
  reps: Rep[];
  treats: TreatCount[];
};

export const formOf = (e: Entry): Form => ({
  at: e.at,
  endedAt: e.endedAt,
  dogIds: e.dogIds,
  walkerIds: e.walkerIds,
  amountG: e.amountG,
  foodKind: e.foodKind,
  unitG: e.unitG,
  count: (e.count ?? []).map((r) => ({ id: r.id, unitG: r.unitG, cans: cansOf(r.amountG, r.unitG) })),
  note: e.note ?? "",
  details: e.details,
  reps: e.reps,
  treats: e.treatCounts,
});

export function editInput(e: Entry, f: Form): Input<"editEntry"> {
  const row = f.count.find((r) => r.id === e.id);
  return {
    id: e.id,
    at: f.at,
    endedAt: f.endedAt,
    dogIds: f.dogIds,
    // an opened can is one can of its size; a count's row its closed cans
    amountG: e.type === "opened" ? f.unitG : row ? row.cans * row.unitG : f.amountG,
    foodKind: f.foodKind,
    unitG: e.type === "opened" ? f.unitG : e.unitG,
    note: f.note.trim() || null,
    details: f.details,
    ...(e.type === "walk" ? { walkers: f.walkerIds } : {}),
  };
}

/** A wet count's other rows whose cans changed, each at the count's time (moving this row moves them all). */
export function countEdits(e: Entry, f: Form): Input<"editEntry">[] {
  const was = new Map((e.count ?? []).map((r) => [r.id, cansOf(r.amountG, r.unitG)]));
  return f.count
    .filter((r) => r.id !== e.id && r.cans !== was.get(r.id))
    .map((r) => ({ id: r.id, at: f.at, endedAt: null, dogIds: [], amountG: r.cans * r.unitG, foodKind: "wet" as const, unitG: r.unitG, note: null }));
}

/** The training's repetitions for the dogs it is now for, and its treats. */
export const trainingInput = (e: Entry, f: Form): Input<"editTraining"> => ({ id: e.id, reps: f.reps.filter((r) => f.dogIds.includes(r.dogId)), treats: f.treats });

export function bumpRep(reps: readonly Rep[], exerciseId: number, dogId: number, field: "ok" | "fail", delta: 1 | -1): Rep[] {
  const found = reps.some((r) => r.exerciseId === exerciseId && r.dogId === dogId);
  const all = found ? [...reps] : [...reps, { exerciseId, dogId, ok: 0, fail: 0 }];
  return all.map((r) => (r.exerciseId === exerciseId && r.dogId === dogId ? { ...r, [field]: Math.max(0, r[field] + delta) } : r));
}

export function bumpTreat(treats: readonly TreatCount[], treatKindId: number, delta: 1 | -1): TreatCount[] {
  const found = treats.some((t) => t.treatKindId === treatKindId);
  const all = found ? [...treats] : [...treats, { treatKindId, count: 0 }];
  return all.map((t) => (t.treatKindId === treatKindId ? { ...t, count: Math.max(0, t.count + delta) } : t));
}

/** A tap on a dog: the one dog of a pee, poop or weight; on or off for the others, keeping at least one. */
export function pickDog(type: EntryType, dogIds: readonly number[], id: number): number[] {
  if (dogRule(type) === "one") return [id];
  if (!dogIds.includes(id)) return [...dogIds, id];
  return keepsOne(dogIds, id) ? dogIds.filter((d) => d !== id) : [...dogIds];
}

/** What Verlauf is filtered by: a person (also the walks they went on), a type, a dog. */
export type Filter = { by?: string; type?: EntryType; dog?: number };

export const historyQuery = (f: Filter, offset: number): Input<"entries"> => ({
  ...(f.by ? { by: f.by } : {}),
  ...(f.type ? { type: f.type } : {}),
  ...(f.dog ? { dog: String(f.dog) } : {}),
  ...(offset ? { offset } : {}),
});
