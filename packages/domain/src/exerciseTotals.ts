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
