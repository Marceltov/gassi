// What a running walk and training look like, and the same view with the taps that have not reached the server yet
// laid over it. The server's view is the truth; the projection only lets the screens answer a tap at once (and keep
// answering without reception). It shows only the running walk and training, so the rules for taps after an end and
// for which dogs a start takes (sessionRules.ts) are applied by the server, whose answer replaces this view.
import type { Command } from "./commands";

export type Person = { id: string; name: string };
export type WalkView = { key: string; startedAt: string; dogIds: number[]; walkers: Person[]; pauses: { startedAt: string; endedAt: string | null }[]; paused: boolean };
/** How often an exercise went well (`ok`) and badly (`fail`) with one dog. */
export type Rep = { exerciseId: number; dogId: number; ok: number; fail: number };
export type TrainingView = { key: string; startedAt: string; dogIds: number[]; walkKey: string | null; reps: Rep[]; treats: Record<number, number> };
export type SessionsView = { walk: WalkView | null; training: TrainingView | null };

const byTime = (a: Command, b: Command) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

function step(v: SessionsView, c: Command, user: Person): SessionsView {
  const { walk, training } = v;
  switch (c.kind) {
    case "walk.start":
    case "walk.join": {
      if (!walk) return c.kind === "walk.start" ? { ...v, walk: { key: c.walkKey, startedAt: c.at, dogIds: c.dogIds ?? [], walkers: [user], pauses: [], paused: false } } : v;
      // A start from this phone lends its key: the server joins it to the walk that really runs, and if the shown walk
      // is an old one (a page cached by the service worker), the taps still reach the walk just started.
      const keyed = c.kind === "walk.start" ? { ...walk, key: c.walkKey } : walk;
      return walk.walkers.some((w) => w.id === user.id) ? { ...v, walk: keyed } : { ...v, walk: { ...keyed, walkers: [...walk.walkers, user] } };
    }
    case "walk.pause":
      return !walk || walk.paused ? v : { ...v, walk: { ...walk, paused: true, pauses: [...walk.pauses, { startedAt: c.at, endedAt: null }] } };
    case "walk.resume":
      return !walk || !walk.paused ? v : { ...v, walk: { ...walk, paused: false, pauses: walk.pauses.map((p) => (p.endedAt === null ? { ...p, endedAt: c.at } : p)) } };
    case "walk.stop":
      return { walk: null, training: training?.walkKey ? null : training };
    case "training.start":
      return training ? { ...v, training: { ...training, key: c.trainingKey } } : { ...v, training: { key: c.trainingKey, startedAt: c.at, dogIds: c.dogIds ?? [], walkKey: c.walkKey ?? null, reps: [], treats: {} } };
    case "training.stop":
      return { ...v, training: null };
    case "training.rep": {
      // like the server, a rep for a dog that is not in the training is dropped (an empty list: the server picks the dogs)
      if (!training || (training.dogIds.length && !training.dogIds.includes(c.dogId))) return v;
      const found = training.reps.find((r) => r.exerciseId === c.exerciseId && r.dogId === c.dogId);
      const field = c.ok ? "ok" : "fail";
      const next = { exerciseId: c.exerciseId, dogId: c.dogId, ok: found?.ok ?? 0, fail: found?.fail ?? 0 };
      next[field] = Math.max(0, next[field] + c.delta);
      return { ...v, training: { ...training, reps: found ? training.reps.map((r) => (r === found ? next : r)) : [...training.reps, next] } };
    }
    case "training.treat": {
      if (!training) return v;
      const count = Math.max(0, (training.treats[c.treatKindId] ?? 0) + c.delta);
      return { ...v, training: { ...training, treats: { ...training.treats, [c.treatKindId]: count } } };
    }
    case "log":
      return v;
  }
}

/** The server's view with the `pending` commands by `user` applied, in time order. */
export function project(view: SessionsView, pending: readonly Command[], user: Person): SessionsView {
  return [...pending].sort(byTime).reduce((v, c) => step(v, c, user), view);
}
