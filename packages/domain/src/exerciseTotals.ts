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

/** The running training's summary: "Sitz 4/5 · Platz 2/4 · 5 Leckerli" (successes/repetitions per exercise, then all treats). */
export function trainingSummaryLine(rows: readonly ExerciseTotal[], treats: number): string {
  const parts = [...exerciseTotals(rows).map(exerciseRate), ...(treats > 0 ? [`${treats} Leckerli`] : [])];
  return parts.length ? parts.join(" · ") : "Noch nichts";
}
