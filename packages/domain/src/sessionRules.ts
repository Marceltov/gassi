// The rules for taps on walks and trainings that don't need the database: when a tap comes too late, when a late
// start joins a walk that has ended since, how a training started on such a walk ends, which dogs a start is for,
// and how long a walk was paused. The server applies them to what it stores (backend/sessions.ts); the phone's
// projection (sessionProjection.ts) shows pending taps the same way.

type Pause = { startedAt: string; endedAt: string | null };

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);

/** A tap at or after the end of its walk or training is too late (a pause, a join, a treat …). */
export const isOver = (endedAt: string | null, at: string): boolean => endedAt !== null && at >= endedAt;

/** Whether something at `at` happened during a walk from `startedAt` to `endedAt` (null while it runs): from its start
 * up to, not including, its end (ADR 0002). The server counts a walk's pee, poop and trainings by it (its queries use
 * the same bounds, `at >= start and at < end`), and the phone lays its unsent taps over a walk by it. */
export const withinWalk = (at: string, startedAt: string, endedAt: string | null): boolean => at >= startedAt && (endedAt === null || at < endedAt);

/** A start that arrives after a stop (queued without reception) joins the walk that was running at its time — but not
 * one whose end lies after `now`, which is an end edited into the future, not a real stop. */
export const joinsEndedSession = (s: { at: string; endedAt: string | null }, at: string, now: string): boolean => s.endedAt !== null && s.at <= at && at < s.endedAt && s.endedAt <= now;

/** A training started on a walk that has ended since ends when the walk ended; null while the walk runs. */
export const startedTrainingEndsAt = (walk: { endedAt: string | null } | undefined): string | null => walk?.endedAt ?? null;

/** The dogs a walk or training is for: the named ones that are active; none named, or none active: every active dog. */
export function resolveDogs(requested: readonly number[] | undefined, active: readonly number[]): number[] {
  const named = (requested ?? []).filter((id) => active.includes(id));
  return named.length ? named : [...active];
}

/** Whether a walk's walkers (or dogs) are not left empty by removing `removing`: the last one stays. */
export const keepsOne = (ids: readonly (string | number)[], removing: string | number): boolean => ids.some((id) => id !== removing);

/** Ms paused between `from` and `to` (a walk's start and end); parts of a pause outside them don't count. */
export function pausedWithin(pauses: readonly Pause[], from: string, to: string): number {
  return pauses.reduce((sum, p) => sum + Math.max(0, Date.parse(earlier(p.endedAt ?? to, to)) - Date.parse(later(p.startedAt, from))), 0);
}
