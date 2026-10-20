// What a running walk and training look like, and the same view with the taps that have not reached the server yet
// laid over it. The server's view is the truth; the projection only lets the screens answer a tap at once (and keep
// answering without reception). It applies the commands the way backend/sessions.ts does, simplified for display.
import type { Command } from "./commands";

export type Person = { username: string; name: string };
export type WalkView = { key: string; startedAt: string; walkers: Person[]; pauses: { startedAt: string; endedAt: string | null }[]; paused: boolean };
export type TrainingView = { key: string; startedAt: string; walkKey: string | null; exercises: number[]; treats: Record<number, number> };
export type SessionsView = { walk: WalkView | null; training: TrainingView | null };

const byTime = (a: Command, b: Command) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

function step(v: SessionsView, c: Command, user: Person): SessionsView {
  const { walk, training } = v;
  switch (c.kind) {
    case "walk.start":
    case "walk.join":
      if (!walk) return c.kind === "walk.start" ? { ...v, walk: { key: c.walkKey, startedAt: c.at, walkers: [user], pauses: [], paused: false } } : v;
      return walk.walkers.some((w) => w.username === user.username) ? v : { ...v, walk: { ...walk, walkers: [...walk.walkers, user] } };
    case "walk.pause":
      return !walk || walk.paused ? v : { ...v, walk: { ...walk, paused: true, pauses: [...walk.pauses, { startedAt: c.at, endedAt: null }] } };
    case "walk.resume":
      return !walk || !walk.paused ? v : { ...v, walk: { ...walk, paused: false, pauses: walk.pauses.map((p) => (p.endedAt === null ? { ...p, endedAt: c.at } : p)) } };
    case "walk.stop":
      return { walk: null, training: training?.walkKey ? null : training };
    case "training.start":
      return training ? v : { ...v, training: { key: c.trainingKey, startedAt: c.at, walkKey: c.walkKey ?? null, exercises: [], treats: {} } };
    case "training.stop":
      return { ...v, training: null };
    case "training.exercise": {
      if (!training) return v;
      const others = training.exercises.filter((id) => id !== c.exerciseId);
      return { ...v, training: { ...training, exercises: c.on ? [...others, c.exerciseId] : others } };
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
