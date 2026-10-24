// What a training practised, summed over its dogs.

/** How a repetition went: klappt, geht so (#100), klappt nicht. Each is counted under its own name. */
export const GRADES = ["ok", "meh", "fail"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_SIGN: Record<Grade, string> = { ok: "✓", meh: "~", fail: "✗" };
export const GRADE_LABEL: Record<Grade, string> = { ok: "klappt", meh: "geht so", fail: "klappt nicht" };
/** How many repetitions went each way. */
export type Counts = Record<Grade, number>;
export const NO_COUNTS: Counts = { ok: 0, meh: 0, fail: 0 };
export const repsOf = (c: Counts): number => c.ok + c.meh + c.fail;
export const addCounts = (a: Counts, b: Counts): Counts => ({ ok: a.ok + b.ok, meh: a.meh + b.meh, fail: a.fail + b.fail });
/** All three counts, always: "✓3 ~1 ✗1", "✓2 ~0 ✗0". */
export const countsLine = (c: Counts): string => GRADES.map((g) => `${GRADE_SIGN[g]}${c[g]}`).join(" ");

/** How an exercise went in one training. */
export type ExerciseTotal = { name: string } & Counts;

/** Sums the per-dog `rows` by exercise name, in the order the names first appear; exercises without a rep are left out. */
export function exerciseTotals(rows: readonly ExerciseTotal[]): ExerciseTotal[] {
  const totals = new Map<string, ExerciseTotal>();
  for (const r of rows) {
    const t = totals.get(r.name) ?? { name: r.name, ...NO_COUNTS };
    totals.set(r.name, { name: r.name, ...addCounts(t, r) });
  }
  return [...totals.values()].filter((t) => repsOf(t) > 0);
}

/** How an exercise went: "Sitz ✓3 ~1 ✗1". */
export const exerciseRate = (t: ExerciseTotal): string => `${t.name} ${countsLine(t)}`;

/** How many treats: "1 Leckerli", "5 Leckerli" (one word for any number, everywhere). */
export const treatsText = (n: number): string => `${n} Leckerli`;

/** A training's parts for any line that shows it: ["Sitz ✓3 ~1 ✗1", "Platz ✓2 ~0 ✗2", "5 Leckerli"] (per exercise,
 * summed over the dogs, then all treats; none without any). */
export function trainingParts(rows: readonly ExerciseTotal[], treats: number): string[] {
  return [...exerciseTotals(rows).map(exerciseRate), ...(treats > 0 ? [treatsText(treats)] : [])];
}

/** The running training's summary: "Sitz ✓3 ~1 ✗1 · 5 Leckerli", "Noch nichts" before the first tap. */
export function trainingSummaryLine(rows: readonly ExerciseTotal[], treats: number): string {
  const parts = trainingParts(rows, treats);
  return parts.length ? parts.join(" · ") : "Noch nichts";
}
