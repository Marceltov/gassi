// Walks and trainings while they run. The screens send commands (shared/commands.ts); this applies them in the order of
// their tap times, each once, in its own transaction. A walk is a "walk" entry from `at` to `ended_at`; its walkers and
// pauses hang off it; a training is a "training" entry with its exercises and treats. What happened during a walk is
// decided by time, not by links: a training or a pee belongs to the walk whose interval holds its `at`.
//
// Rules for commands that arrive late (a phone without reception, the other phone already stopped the walk):
// - a pee/poop always becomes an entry at its own time, inside the walk or not;
// - a pause, resume, join, training start or training tap at or after the end of its walk/training is dropped;
// - a second "start" while a walk runs joins that walk (both people tapped Gassi at the door); its key becomes an
//   alias of the running walk, so its later taps land there. A start arriving after the stop joins the walk that was
//   running at its time. Trainings do the same; a training started on a walk that has since ended ends with it.
import { sql, type Kysely } from "kysely";
import { type Command, type Entry, minutesBetween, type Person, type SessionsView, type TrainingView, type WalkView } from "@gassi/domain";
import type { User } from "./auth/session";
import { database, type DB } from "./db/open";
import type { Schema } from "./db/schema";
import { currentDog, type Dog } from "./dogs";
import { EntryRepository } from "./entries/repository";
import { type Names, PeopleRepository } from "./people";


export type { Person, SessionsView, TrainingView, WalkView };

export type TrainingSummary = { min: number; exercises: string[]; treats: { name: string; count: number }[] };
export type WalkSummary = {
  id: number; // the walk's entry
  note: string | null;
  startedAt: string;
  endedAt: string | null;
  totalMin: number;
  pauseMin: number;
  pauseCount: number;
  walkers: Person[];
  trainings: TrainingSummary[];
  pee: number;
  poop: number;
};

export type SessionsDeps = { db: DB; dog: Dog; names: Names; now: () => Date };

type Tx = Kysely<Schema>;
type Outcome = "applied" | "dropped";

/** Ms paused between `from` and `to` (a walk's start and end); parts of a pause outside them don't count. */
export function pausedWithin(pauses: readonly { startedAt: string; endedAt: string | null }[], from: string, to: string): number {
  return pauses.reduce((sum, p) => sum + Math.max(0, Date.parse(earlier(p.endedAt ?? to, to)) - Date.parse(later(p.startedAt, from))), 0);
}

const isOver = (e: Entry, at: string) => e.endedAt !== null && at >= e.endedAt;
const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);
const byTime = (a: Command, b: Command) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

export class Sessions {
  constructor(private readonly deps: SessionsDeps) {}

  /** Applies `commands` by `user` in time order. An id seen before is not applied again and counts as applied. */
  async apply(user: User, commands: readonly Command[]): Promise<{ applied: string[]; dropped: string[] }> {
    const result = { applied: [] as string[], dropped: [] as string[] };
    for (const c of [...commands].sort(byTime)) {
      const outcome = await this.deps.db.transaction().execute(async (tx) => {
        const seen = await tx.selectFrom("applied_command").select("id").where("id", "=", c.id).executeTakeFirst();
        if (seen) return "applied";
        const o = await new Step(tx, this.deps, user).run(c);
        await tx.insertInto("applied_command").values({ id: c.id, applied_at: this.deps.now().toISOString() }).execute();
        return o;
      });
      result[outcome].push(c.id);
    }
    // a phone resends within minutes or days, never after a month: older ids need not be remembered
    const forget = new Date(this.deps.now().getTime() - 30 * 86_400_000).toISOString();
    await this.deps.db.deleteFrom("applied_command").where("applied_at", "<", forget).execute();
    return result;
  }

  /** The walk and the training running now, if any. */
  async current(): Promise<SessionsView> {
    const { db } = this.deps;
    const repo = new EntryRepository(db);
    const [walk, training] = await Promise.all([repo.running("walk"), repo.running("training")]);
    return {
      walk: walk ? { key: walk.clientKey!, startedAt: walk.at, walkers: await this.walkers(walk.id), ...(await this.pauses(walk.id)) } : null,
      training: training ? await this.trainingView(training, walk) : null,
    };
  }

  /** What a walk was: its times, walkers, trainings and the pee/poop during it. A running walk is counted up to now. */
  async summary(walkEntryId: number): Promise<WalkSummary> {
    const repo = new EntryRepository(this.deps.db);
    const walk = await repo.get(walkEntryId);
    if (!walk || walk.type !== "walk") throw new Error(`entry ${walkEntryId} is not a walk`);
    const end = walk.endedAt ?? this.deps.now().toISOString();
    const during = await repo.list({ dogId: walk.dogId, since: walk.at, until: end });
    const { pauses } = await this.pauses(walk.id);
    const pauseMs = pausedWithin(pauses, walk.at, end);
    const trainings = during.filter((e) => e.type === "training").reverse();
    return {
      id: walk.id,
      note: walk.note,
      startedAt: walk.at,
      endedAt: walk.endedAt,
      totalMin: minutesBetween(walk.at, end)!,
      pauseMin: Math.round(pauseMs / 60_000),
      pauseCount: pauses.length,
      walkers: await this.walkers(walk.id),
      trainings: await Promise.all(trainings.map((t) => this.trainingSummary(t, end))),
      pee: during.filter((e) => e.type === "pee").length,
      poop: during.filter((e) => e.type === "poop").length,
    };
  }

  /** The summary of the walk started (or joined) with `key`, or null when the server doesn't know that key yet. */
  async summaryFor(key: string): Promise<WalkSummary | null> {
    const walk = await findByKey(this.deps.db, key, "walk");
    return walk ? this.summary(walk.id) : null;
  }

  private async walkers(entryId: number): Promise<Person[]> {
    const rows = await this.deps.db.selectFrom("walk_walker").select("username").where("entry_id", "=", entryId).orderBy(sql`rowid`).execute();
    return rows.map((r) => ({ username: r.username, name: this.deps.names.get(r.username) ?? r.username }));
  }

  private async pauses(entryId: number): Promise<Pick<WalkView, "pauses" | "paused">> {
    const rows = await this.deps.db.selectFrom("walk_pause").select(["started_at", "ended_at"]).where("entry_id", "=", entryId).orderBy("started_at").execute();
    const pauses = rows.map((r) => ({ startedAt: r.started_at, endedAt: r.ended_at }));
    return { pauses, paused: pauses.some((p) => p.endedAt === null) };
  }

  private async trainingView(t: Entry, walk: Entry | undefined): Promise<TrainingView> {
    const { db } = this.deps;
    const [exercises, treats] = await Promise.all([
      db.selectFrom("training_exercise").select("exercise_id").where("entry_id", "=", t.id).orderBy(sql`rowid`).execute(),
      db.selectFrom("training_treat").select(["treat_kind_id", "count"]).where("entry_id", "=", t.id).where("count", ">", 0).execute(),
    ]);
    return {
      key: t.clientKey!,
      startedAt: t.at,
      walkKey: walk && walk.at <= t.at ? walk.clientKey : null,
      exercises: exercises.map((r) => r.exercise_id),
      treats: Object.fromEntries(treats.map((r) => [r.treat_kind_id, r.count])),
    };
  }

  private async trainingSummary(t: Entry, walkEnd: string): Promise<TrainingSummary> {
    const { db } = this.deps;
    const [exercises, treats] = await Promise.all([
      db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select("exercise.name").where("entry_id", "=", t.id).orderBy(sql`training_exercise.rowid`).execute(),
      db.selectFrom("training_treat").innerJoin("treat_kind", "treat_kind.id", "training_treat.treat_kind_id").select(["treat_kind.name", "count"]).where("entry_id", "=", t.id).where("count", ">", 0).orderBy("treat_kind.name").execute(),
    ]);
    return { min: minutesBetween(t.at, t.endedAt ?? walkEnd)!, exercises: exercises.map((r) => r.name), treats };
  }
}

/** The walk or training started with `key`, or the running one that a second start with `key` joined. */
async function findByKey(db: Tx, key: string, type: "walk" | "training"): Promise<Entry | undefined> {
  const entries = new EntryRepository(db);
  let e = await entries.byClientKey(key);
  if (!e) {
    const alias = await db.selectFrom("session_alias").select("entry_id").where("key", "=", key).executeTakeFirst();
    e = alias && (await entries.get(alias.entry_id));
  }
  return e?.type === type ? e : undefined;
}

// One command inside its transaction.
class Step {
  private readonly entries: EntryRepository;

  constructor(
    private readonly tx: Tx,
    private readonly deps: SessionsDeps,
    private readonly user: User,
  ) {
    this.entries = new EntryRepository(tx, deps.now);
  }

  async run(c: Command): Promise<Outcome> {
    switch (c.kind) {
      case "walk.start":
        return this.start("walk", c.walkKey, c.at);
      case "walk.join":
        return this.onWalk(c.walkKey, c.at, (w) => this.addWalker(w.id));
      case "walk.pause":
        return this.onWalk(c.walkKey, c.at, (w) => this.pause(w, c.at));
      case "walk.resume":
        return this.onWalk(c.walkKey, c.at, (w) => this.resume(w, c.at));
      case "walk.stop":
        return this.stopWalk(c.walkKey, c.at);
      case "training.start": {
        const walk = c.walkKey ? await this.find(c.walkKey, "walk") : undefined;
        if (c.walkKey && (!walk || isOver(walk, c.at))) return "dropped";
        // started before the walk ended but arriving after the stop: it ended with the walk
        return this.start("training", c.trainingKey, c.at, walk?.endedAt ?? null);
      }
      case "training.stop": {
        const t = await this.find(c.trainingKey, "training");
        if (!t || t.endedAt) return "dropped";
        await this.end(t, c.at);
        return "applied";
      }
      case "training.exercise":
        return this.onTraining(c.trainingKey, c.at, (t) => this.exercise(t, c.exerciseId, c.on));
      case "training.treat":
        return this.onTraining(c.trainingKey, c.at, (t) => this.treat(t, c.treatKindId, c.delta));
      case "log":
        await this.create(c.type, c.at, null);
        return "applied";
    }
  }

  private find(key: string, type: "walk" | "training"): Promise<Entry | undefined> {
    return findByKey(this.tx, key, type);
  }

  private create(type: Entry["type"], at: string, clientKey: string | null): Promise<Entry> {
    return this.entries.create({ type, at, endedAt: null, amountG: null, foodKind: null, unitG: null, note: null, dogId: this.deps.dog.id, loggedBy: this.user.username, clientKey });
  }

  // A start joins the walk/training that runs now, or the one that was running at the tap's time (a start queued without
  // reception that arrives after the stop); only otherwise does it begin a new one.
  private async start(type: "walk" | "training", key: string, at: string, endedAt: string | null = null): Promise<Outcome> {
    let e = await this.find(key, type);
    if (e && isOver(e, at)) return "dropped";
    if (!e) {
      e = (await this.entries.running(type)) ?? (await this.endedAround(type, at));
      if (e) {
        await this.tx.insertInto("session_alias").values({ key, entry_id: e.id }).execute();
        // the other phone tapped first but sent later: the walk began at its tap
        if (at < e.at) {
          await this.tx.updateTable("entry").set({ at, updated_at: this.deps.now().toISOString() }).where("id", "=", e.id).execute();
          e = { ...e, at };
        }
      }
      else {
        e = await this.create(type, at, key);
        if (endedAt) await this.end(e, endedAt);
      }
    }
    if (type === "walk") await this.addWalker(e.id);
    return "applied";
  }

  private async endedAround(type: "walk" | "training", at: string): Promise<Entry | undefined> {
    const row = await this.tx
      .selectFrom("entry")
      .select("id")
      .where("type", "=", type)
      .where("client_key", "is not", null)
      .where("at", "<=", at)
      .where("ended_at", ">", at)
      .where("ended_at", "<=", this.deps.now().toISOString()) // a real stop, not an end edited into the future
      .orderBy("at", "desc")
      .executeTakeFirst();
    return row && this.entries.get(row.id);
  }

  private async onWalk(key: string, at: string, act: (w: Entry) => Promise<void>): Promise<Outcome> {
    const w = await this.find(key, "walk");
    if (!w || isOver(w, at)) return "dropped";
    await act(w);
    return "applied";
  }

  private async onTraining(key: string, at: string, act: (t: Entry) => Promise<Outcome>): Promise<Outcome> {
    const t = await this.find(key, "training");
    if (!t || isOver(t, at)) return "dropped";
    return act(t);
  }

  private async addWalker(entryId: number): Promise<void> {
    await this.tx
      .insertInto("walk_walker")
      .values({ entry_id: entryId, username: this.user.username })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  // On a walk that has already ended (the stop arrived first), the pause ends with the walk until a resume says otherwise.
  private async pause(w: Entry, at: string): Promise<void> {
    const open = await this.tx.selectFrom("walk_pause").select("id").where("entry_id", "=", w.id).where("ended_at", "is", null).executeTakeFirst();
    if (!open) await this.tx.insertInto("walk_pause").values({ entry_id: w.id, started_at: at, ended_at: w.endedAt }).execute();
  }

  private async resume(w: Entry, at: string): Promise<void> {
    const last = await this.tx.selectFrom("walk_pause").select(["id", "ended_at"]).where("entry_id", "=", w.id).where("started_at", "<=", at).orderBy("started_at", "desc").executeTakeFirst();
    if (last && (last.ended_at === null || last.ended_at > at)) await this.tx.updateTable("walk_pause").set({ ended_at: at }).where("id", "=", last.id).execute();
  }

  private async end(e: Entry, at: string): Promise<string> {
    const end = later(at, e.at);
    await this.tx.updateTable("entry").set({ ended_at: end, updated_at: this.deps.now().toISOString() }).where("id", "=", e.id).execute();
    return end;
  }

  // Ends the walk, its pauses at the same moment (pauses that began later never happened), and a training that runs
  // during it.
  private async stopWalk(key: string, at: string): Promise<Outcome> {
    const w = await this.find(key, "walk");
    if (!w || w.endedAt) return "dropped";
    const end = await this.end(w, at);
    await this.tx.deleteFrom("walk_pause").where("entry_id", "=", w.id).where("started_at", ">=", end).execute();
    await this.tx
      .updateTable("walk_pause")
      .set({ ended_at: end })
      .where("entry_id", "=", w.id)
      .where((eb) => eb.or([eb("ended_at", "is", null), eb("ended_at", ">", end)]))
      .execute();
    const training = await this.entries.running("training");
    if (training && training.at >= w.at && training.at < end) await this.end(training, end);
    return "applied";
  }

  private async exercise(t: Entry, exerciseId: number, on: boolean): Promise<Outcome> {
    const exists = await this.tx.selectFrom("exercise").select("id").where("id", "=", exerciseId).executeTakeFirst();
    if (!exists) return "dropped";
    if (on) await this.tx.insertInto("training_exercise").values({ entry_id: t.id, exercise_id: exerciseId }).onConflict((oc) => oc.doNothing()).execute();
    else await this.tx.deleteFrom("training_exercise").where("entry_id", "=", t.id).where("exercise_id", "=", exerciseId).execute();
    return "applied";
  }

  private async treat(t: Entry, treatKindId: number, delta: 1 | -1): Promise<Outcome> {
    const kind = await this.tx.selectFrom("treat_kind").select(["grams_per_piece", "from_dry"]).where("id", "=", treatKindId).executeTakeFirst();
    if (!kind) return "dropped";
    const row = await this.tx.selectFrom("training_treat").select("count").where("entry_id", "=", t.id).where("treat_kind_id", "=", treatKindId).executeTakeFirst();
    const count = Math.max(0, (row?.count ?? 0) + delta);
    await this.tx
      .insertInto("training_treat")
      .values({ entry_id: t.id, treat_kind_id: treatKindId, count, grams_per_piece: kind.grams_per_piece, from_dry: kind.from_dry })
      .onConflict((oc) => oc.columns(["entry_id", "treat_kind_id"]).doUpdateSet({ count }))
      .execute();
    return "applied";
  }
}

/** The sessions for one request, on the configured database and dog, with the names as they are now. */
export async function sessions(): Promise<Sessions> {
  const db = await database();
  const [dog, names] = await Promise.all([currentDog(db), new PeopleRepository(db).names()]);
  return new Sessions({ db, dog, names, now: () => new Date() });
}
