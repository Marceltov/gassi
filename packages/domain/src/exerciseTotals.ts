// What a training practised, summed over its dogs.

/** How often an exercise went well and badly in one training. */
export type ExerciseTotal = { name: string; ok: number; fail: number };

/** Sums the per-dog `rows` by exercise name, in the order the names first appear; exercises without a rep are left out. */
export function exerciseTotals(rows: readonly ExerciseTotal[]): ExerciseTotal[] {
  const totals = new Map<string, ExerciseTotal>();
  for (const r of rows) {
    const t = totals.get(r.name) ?? { name: r.name, ok: 0, fail: 0 };
    totals.set(r.name, { name: r.name, ok: t.ok + r.ok, fail: t.fail + r.fail });
  }
  return [...totals.values()].filter((t) => t.ok + t.fail > 0);
}

/** An exercise's success: "Sitz 4/5" (successes / repetitions). */
export const exerciseRate = (t: ExerciseTotal): string => `${t.name} ${t.ok}/${t.ok + t.fail}`;

/** How many treats: "1 Leckerli", "5 Leckerli" (one word for any number, everywhere). */
export const treatsText = (n: number): string => `${n} Leckerli`;

/** A training's parts for any line that shows it: ["Sitz 4/5", "Platz 2/4", "5 Leckerli"] (successes/repetitions per
 * exercise, summed over the dogs, then all treats; none without any). */
export function trainingParts(rows: readonly ExerciseTotal[], treats: number): string[] {
  return [...exerciseTotals(rows).map(exerciseRate), ...(treats > 0 ? [treatsText(treats)] : [])];
}

/** The running training's summary: "Sitz 4/5 · Platz 2/4 · 5 Leckerli", "Noch nichts" before the first tap. */
export function trainingSummaryLine(rows: readonly ExerciseTotal[], treats: number): string {
  const parts = trainingParts(rows, treats);
  return parts.length ? parts.join(" · ") : "Noch nichts";
}
