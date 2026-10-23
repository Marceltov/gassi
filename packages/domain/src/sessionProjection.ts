// What a running walk and training look like, and the same view with the taps that have not reached the server yet
// laid over it. The server's view is the truth; the projection only lets the screens answer a tap at once (and keep
// answering without reception). It shows only the running walk and training, so the rules for taps after an end
// (sessionRules.ts) are applied by the server, whose answer replaces this view; which dogs a start takes is decided
// here the same way, from the active dogs the phone knows.
import type { Command } from "./commands";
import { keepsOne, resolveDogs } from "./sessionRules";

export type Person = { id: string; name: string };
export type WalkView = { key: string; startedAt: string; dogIds: number[]; walkers: Person[]; pauses: { startedAt: string; endedAt: string | null }[]; paused: boolean };
/** How often an exercise went well (`ok`) and badly (`fail`) with one dog. */
export type Rep = { exerciseId: number; dogId: number; ok: number; fail: number };
export type TrainingView = { key: string; startedAt: string; dogIds: number[]; walkKey: string | null; reps: Rep[]; treats: Record<number, number> };
export type SessionsView = { walk: WalkView | null; training: TrainingView | null };

const byTime = (a: Command, b: Command) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

function step(v: SessionsView, c: Command, user: Person, people: readonly Person[], activeDogs: readonly number[]): SessionsView {
  const { walk, training } = v;
  // without the active dogs, a start shows the dogs it names (none: the server's answer brings them)
  const dogsFor = (requested: readonly number[] | undefined) => (activeDogs.length ? resolveDogs(requested, activeDogs) : [...(requested ?? [])]);
  switch (c.kind) {
    case "walk.start":
    case "walk.join": {
      if (!walk) return c.kind === "walk.start" ? { ...v, walk: { key: c.walkKey, startedAt: c.at, dogIds: dogsFor(c.dogIds), walkers: [user], pauses: [], paused: false } } : v;
      // A start from this phone lends its key: the server joins it to the walk that really runs, and if the shown walk
      // is an old one (a page cached by the service worker), the taps still reach the walk just started.
      const keyed = c.kind === "walk.start" ? { ...walk, key: c.walkKey } : walk;
      return walk.walkers.some((w) => w.id === user.id) ? { ...v, walk: keyed } : { ...v, walk: { ...keyed, walkers: [...walk.walkers, user] } };
    }
    case "walk.walker": {
      if (!walk) return v;
      if (c.on) {
        // a person the phone doesn't know by name can't be shown; the server's answer will bring them
        const person = people.find((p) => p.id === c.personId);
        return !person || walk.walkers.some((w) => w.id === c.personId) ? v : { ...v, walk: { ...walk, walkers: [...walk.walkers, person] } };
      }
      return keepsOne(walk.walkers.map((w) => w.id), c.personId) ? { ...v, walk: { ...walk, walkers: walk.walkers.filter((w) => w.id !== c.personId) } } : v;
    }
    case "walk.dog": {
      if (!walk) return v;
      if (c.on) return walk.dogIds.includes(c.dogId) ? v : { ...v, walk: { ...walk, dogIds: [...walk.dogIds, c.dogId].sort((a, b) => a - b) } };
      return keepsOne(walk.dogIds, c.dogId) ? { ...v, walk: { ...walk, dogIds: walk.dogIds.filter((d) => d !== c.dogId) } } : v;
    }
    case "walk.pause":
      return !walk || walk.paused ? v : { ...v, walk: { ...walk, paused: true, pauses: [...walk.pauses, { startedAt: c.at, endedAt: null }] } };
    case "walk.resume":
      return !walk || !walk.paused ? v : { ...v, walk: { ...walk, paused: false, pauses: walk.pauses.map((p) => (p.endedAt === null ? { ...p, endedAt: c.at } : p)) } };
    case "walk.stop":
      return { walk: null, training: training?.walkKey ? null : training };
    case "training.start":
      return training ? { ...v, training: { ...training, key: c.trainingKey } } : { ...v, training: { key: c.trainingKey, startedAt: c.at, dogIds: dogsFor(c.dogIds), walkKey: c.walkKey ?? null, reps: [], treats: {} } };
    case "training.stop":
      return { ...v, training: null };
    case "training.rep": {
      // like the server, a rep for a dog that is not in the training is dropped (an empty list: dogs not known yet)
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
    case "log.consistency":
    case "food":
    case "can.open":
      return v;
  }
}

/** The server's view with the `pending` commands by `user` applied, in time order. `people` are the household's
 * members, whose names a pending walker change shows; `activeDogs` the ids of its active dogs, which a pending start
 * takes. */
export function project(view: SessionsView, pending: readonly Command[], user: Person, people: readonly Person[] = [user], activeDogs: readonly number[] = []): SessionsView {
  return [...pending].sort(byTime).reduce((v, c) => step(v, c, user, people, activeDogs), view);
}
