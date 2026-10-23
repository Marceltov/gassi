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
import { checkDetails, checkDogs, type Command, isPractice, type Consistency, type Entry, type EntryDetails, withDetail, type ExerciseTotal, exerciseTotals, type FoodKind, isOver, joinsEndedSession, keepsOne, minutesBetween, pausedWithin, type Person, resolveDogs, type SessionsView, startedTrainingEndsAt, type TrainingView, type WalkView, withinWalk } from "@gassi/domain";
import type { DB } from "./db/open";
import type { Schema } from "./db/schema";
import { DogRepository } from "./dogs";
import { EntryRepository } from "./entries/repository";
import type { Names } from "./people";


export type { Person, SessionsView, TrainingView, WalkView };

export type TrainingSummary = { id: number; startedAt: string; min: number; exercises: ExerciseTotal[]; treats: { name: string; count: number }[] };
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
  pees: Tap[]; // oldest first
  marks: Tap[];
  poops: Tap[];
  logged: Logged[]; // oldest first
};
/** A note, an encounter, a command or a treat during a walk (#91, #37, #90, #36); a command's repetition and the
 * treats are named. */
export type Logged = { id: number; at: string; type: LoggedType; dogId: number | null; note: string | null; details: EntryDetails | null; exercises: ExerciseTotal[]; treats: { name: string; count: number }[] };
type LoggedType = "note" | "dogEncounter" | "personEncounter" | "command" | "treat";
const LOGGED: readonly string[] = ["note", "dogEncounter", "personEncounter", "command", "treat"] satisfies LoggedType[];
/** A pee, marking or poop during a walk: its entry, when, which dog, and a poop's consistency. */
export type Tap = { id: number; at: string; dogId: number; consistency: Consistency | null };

export type SessionsDeps = { db: DB; names: Names; now: () => Date };

type Tx = Kysely<Schema>;
type Outcome = "applied" | "dropped";

const later = (a: string, b: string) => (a > b ? a : b);
const byTime = (a: Command, b: Command) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

export class Sessions {
  constructor(private readonly deps: SessionsDeps) {}

  /** Applies `commands` by `user` in time order. An id seen before is not applied again and counts as applied. */
  async apply(user: Person, commands: readonly Command[]): Promise<{ applied: string[]; dropped: string[] }> {
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
      walk: walk ? { key: walk.clientKey!, startedAt: walk.at, dogIds: walk.dogIds, walkers: await this.walkers(walk.id), ...(await this.pauses(walk.id)) } : null,
      training: training ? await this.trainingView(training, walk) : null,
    };
  }

  /** What a walk was: its times, walkers, trainings and each pee/poop during it. A running walk is counted up to now. */
  async summary(walkEntryId: number): Promise<WalkSummary> {
    const repo = new EntryRepository(this.deps.db);
    const walk = await repo.get(walkEntryId);
    if (!walk || walk.type !== "walk") throw new Error(`entry ${walkEntryId} is not a walk`);
    const end = walk.endedAt ?? this.deps.now().toISOString();
    const during = await repo.list({ since: walk.at, until: end }); // withinWalk's bounds, in the query
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
      pees: taps(during, "pee"),
      marks: taps(during, "mark"),
      poops: taps(during, "poop"),
      logged: await Promise.all(
        during
          .filter((e): e is Entry & { type: LoggedType } => LOGGED.includes(e.type))
          .reverse()
          .map(async (e) => {
            const done = isPractice(e.type) ? await this.trainingSummary(e, end) : { exercises: [], treats: [] };
            return { id: e.id, at: e.at, type: e.type, dogId: e.dogIds[0] ?? null, note: e.note, details: e.details, exercises: done.exercises, treats: done.treats };
          }),
      ),
    };
  }

  /** The summary of the walk started (or joined) with `key`, or null when the server doesn't know that key yet. */
  async summaryFor(key: string): Promise<WalkSummary | null> {
    const walk = await findByKey(this.deps.db, key, "walk");
    return walk ? this.summary(walk.id) : null;
  }

  private async walkers(entryId: number): Promise<Person[]> {
    const rows = await this.deps.db.selectFrom("walk_walker").select("person_id").where("entry_id", "=", entryId).orderBy(sql`rowid`).execute();
    return rows.map((r) => ({ id: r.person_id, name: this.deps.names.get(r.person_id) ?? r.person_id }));
  }

  private async pauses(entryId: number): Promise<Pick<WalkView, "pauses" | "paused">> {
    const rows = await this.deps.db.selectFrom("walk_pause").select(["started_at", "ended_at"]).where("entry_id", "=", entryId).orderBy("started_at").execute();
    const pauses = rows.map((r) => ({ startedAt: r.started_at, endedAt: r.ended_at }));
    return { pauses, paused: pauses.some((p) => p.endedAt === null) };
  }

  private async trainingView(t: Entry, walk: Entry | undefined): Promise<TrainingView> {
    const { db } = this.deps;
    const [exercises, treats] = await Promise.all([
      db.selectFrom("training_exercise").select(["exercise_id", "dog_id", "ok_count", "fail_count"]).where("entry_id", "=", t.id).orderBy(sql`rowid`).execute(),
      db.selectFrom("training_treat").select(["treat_kind_id", "count"]).where("entry_id", "=", t.id).where("count", ">", 0).execute(),
    ]);
    return {
      key: t.clientKey!,
      startedAt: t.at,
      dogIds: t.dogIds,
      walkKey: walk && withinWalk(t.at, walk.at, walk.endedAt) ? walk.clientKey : null,
      reps: exercises.map((r) => ({ exerciseId: r.exercise_id, dogId: r.dog_id, ok: r.ok_count, fail: r.fail_count })),
      treats: Object.fromEntries(treats.map((r) => [r.treat_kind_id, r.count])),
    };
  }

  private async trainingSummary(t: Entry, walkEnd: string): Promise<TrainingSummary> {
    const { db } = this.deps;
    const [exercises, treats] = await Promise.all([
      db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["exercise.name", "ok_count", "fail_count"]).where("entry_id", "=", t.id).orderBy(sql`training_exercise.rowid`).execute(),
      db.selectFrom("training_treat").innerJoin("treat_kind", "treat_kind.id", "training_treat.treat_kind_id").select(["treat_kind.name", "count"]).where("entry_id", "=", t.id).where("count", ">", 0).orderBy("treat_kind.name").execute(),
    ]);
    return { id: t.id, startedAt: t.at, min: minutesBetween(t.at, t.endedAt ?? walkEnd)!, exercises: exerciseTotals(exercises.map((r) => ({ name: r.name, ok: r.ok_count, fail: r.fail_count }))), treats };
  }
}

// `during` is newest first; pee, markings and poop are for exactly one dog
const taps = (during: readonly Entry[], type: "pee" | "mark" | "poop"): Tap[] =>
  during
    .filter((e) => e.type === type)
    .reverse()
    .map((e) => ({ id: e.id, at: e.at, dogId: e.dogIds[0], consistency: e.details?.consistency ?? null }));

/** The walk or training started with `key`, or the running one that a second start with `key` joined. */
export async function findByKey(db: Tx, key: string, type: "walk" | "training"): Promise<Entry | undefined> {
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
    private readonly user: Person,
  ) {
    this.entries = new EntryRepository(tx, deps.now);
  }

  async run(c: Command): Promise<Outcome> {
    switch (c.kind) {
      case "walk.start":
        return this.start("walk", c.walkKey, c.at, null, c.dogIds);
      case "walk.join":
        return this.onWalk(c.walkKey, c.at, (w) => this.addWalker(w.id));
      case "walk.walker":
        return this.onWalk(c.walkKey, c.at, (w) => this.setWalker(w, c.personId, c.on));
      case "walk.dog":
        return this.onWalk(c.walkKey, c.at, (w) => this.setDog(w, c.dogId, c.on));
      case "walk.pause":
        return this.onWalk(c.walkKey, c.at, (w) => this.pause(w, c.at));
      case "walk.resume":
        return this.onWalk(c.walkKey, c.at, (w) => this.resume(w, c.at));
      case "walk.stop":
        return this.stopWalk(c.walkKey, c.at);
      case "training.start": {
        const walk = c.walkKey ? await this.find(c.walkKey, "walk") : undefined;
        if (c.walkKey && (!walk || isOver(walk.endedAt, c.at))) return "dropped";
        // started before the walk ended but arriving after the stop: it ended with the walk
        return this.start("training", c.trainingKey, c.at, startedTrainingEndsAt(walk), c.dogIds);
      }
      case "training.stop": {
        const t = await this.find(c.trainingKey, "training");
        if (!t || t.endedAt) return "dropped";
        await this.end(t, c.at);
        return "applied";
      }
      case "training.rep":
        return this.onTraining(c.trainingKey, c.at, (t) => this.rep(t, c.exerciseId, c.dogId, c.ok, c.delta));
      case "training.treat":
        return this.onTraining(c.trainingKey, c.at, (t) => this.treat(t, c.treatKindId, c.delta));
      case "log": {
        // a dog that isn't (or is no longer) the household's: the tap can't belong anywhere
        if (!(await this.activeDogs()).includes(c.dogId)) return "dropped";
        await this.create(c.type, c.at, null, [c.dogId]);
        return "applied";
      }
      case "log.consistency": {
        // the poop may have been deleted, moved or changed into something else in Verlauf since
        const poop = (await this.entries.list({ type: "poop", dogId: c.dogId, since: c.poopAt })).findLast((e) => e.at === c.poopAt);
        if (!poop) return "dropped";
        await this.entries.update(poop.id, { ...poop, details: withDetail(poop.details, "consistency", c.consistency) });
        return "applied";
      }
      case "log.entry": {
        // a dog that isn't the household's, or details that don't fit: nothing to keep (the app checks the same first)
        const dogIds = c.dogId === undefined ? [] : [c.dogId];
        if (c.dogId !== undefined && !(await this.activeDogs()).includes(c.dogId)) return "dropped";
        const details = c.details && Object.keys(c.details).length ? c.details : null;
        if (checkDogs(c.type, dogIds) || checkDetails(c.type, details)) return "dropped";
        await this.entries.create({ type: c.type, at: c.at, endedAt: null, amountG: null, foodKind: null, unitG: null, note: c.note || null, details, dogIds, loggedBy: this.user.id });
        return "applied";
      }
      case "quick.command":
      case "quick.treat": {
        // a repetition and a treat without a training (#36): an entry of their own, with the same rows a training has
        if (!(await this.activeDogs()).includes(c.dogId)) return "dropped";
        const e = await this.create(c.kind === "quick.command" ? "command" : "treat", c.at, null, [c.dogId]);
        const done = c.kind === "quick.command" ? await this.rep(e, c.exerciseId, c.dogId, c.ok, 1) : "applied";
        if (done === "dropped" || (c.treatKindId !== undefined && (await this.treat(e, c.treatKindId, 1)) === "dropped")) {
          await this.entries.remove(e.id); // an exercise or treat kind that is gone: nothing half
          return "dropped";
        }
        return "applied";
      }
      case "food":
        // the same kind of entry the diary logs, so stock and the usual portion see it
        await this.create("food", c.at, null, await this.dogsFor(c.dogIds), { amountG: c.amountG, foodKind: c.foodKind, unitG: null });
        return "applied";
      case "can.open":
        // one closed can less in Vorrat; the household's, so no dog
        await this.create("opened", c.at, null, [], { amountG: c.unitG, foodKind: "wet", unitG: c.unitG });
        return "applied";
    }
  }

  private find(key: string, type: "walk" | "training"): Promise<Entry | undefined> {
    return findByKey(this.tx, key, type);
  }

  private activeDogs(): Promise<number[]> {
    return new DogRepository(this.tx).activeIds();
  }

  private async dogsFor(requested: readonly number[] | undefined): Promise<number[]> {
    return resolveDogs(requested, await this.activeDogs());
  }

  private create(type: Entry["type"], at: string, clientKey: string | null, dogIds: number[], food?: { amountG: number; foodKind: FoodKind; unitG: number | null }): Promise<Entry> {
    return this.entries.create({ type, at, endedAt: null, amountG: food?.amountG ?? null, foodKind: food?.foodKind ?? null, unitG: food?.unitG ?? null, note: null, dogIds, loggedBy: this.user.id, clientKey });
  }

  // A start joins the walk/training that runs now, or the one that was running at the tap's time (a start queued without
  // reception that arrives after the stop); only otherwise does it begin a new one.
  private async start(type: "walk" | "training", key: string, at: string, endedAt: string | null, dogIds: readonly number[] | undefined): Promise<Outcome> {
    let e = await this.find(key, type);
    if (e && isOver(e.endedAt, at)) return "dropped";
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
        e = await this.create(type, at, key, await this.dogsFor(dogIds));
        if (endedAt) await this.end(e, endedAt);
      }
    }
    if (type === "walk") await this.addWalker(e.id);
    return "applied";
  }

  // The walk/training a late start joins (joinsEndedSession); the query only narrows the candidates.
  private async endedAround(type: "walk" | "training", at: string): Promise<Entry | undefined> {
    const rows = await this.tx.selectFrom("entry").select(["id", "at", "ended_at"]).where("type", "=", type).where("client_key", "is not", null).where("at", "<=", at).where("ended_at", ">", at).orderBy("at", "desc").execute();
    const now = this.deps.now().toISOString();
    const hit = rows.find((r) => joinsEndedSession({ at: r.at, endedAt: r.ended_at }, at, now));
    return hit && this.entries.get(hit.id);
  }

  private async onWalk(key: string, at: string, act: (w: Entry) => Promise<Outcome | void>): Promise<Outcome> {
    const w = await this.find(key, "walk");
    if (!w || isOver(w.endedAt, at)) return "dropped";
    return (await act(w)) ?? "applied";
  }

  private async onTraining(key: string, at: string, act: (t: Entry) => Promise<Outcome>): Promise<Outcome> {
    const t = await this.find(key, "training");
    if (!t || isOver(t.endedAt, at)) return "dropped";
    return act(t);
  }

  private async addWalker(entryId: number): Promise<void> {
    await this.tx
      .insertInto("walk_walker")
      .values({ entry_id: entryId, person_id: this.user.id })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  // Adding what is there already, or removing what is not, changes nothing; the last walker (or dog) stays.
  private async setWalker(w: Entry, personId: string, on: boolean): Promise<Outcome> {
    const rows = await this.tx.selectFrom("walk_walker").select("person_id").where("entry_id", "=", w.id).execute();
    if (on) {
      if (!(await this.tx.selectFrom("person").select("id").where("id", "=", personId).executeTakeFirst())) return "dropped";
      await this.tx.insertInto("walk_walker").values({ entry_id: w.id, person_id: personId }).onConflict((oc) => oc.doNothing()).execute();
    } else {
      if (!keepsOne(rows.map((r) => r.person_id), personId)) return "dropped";
      await this.tx.deleteFrom("walk_walker").where("entry_id", "=", w.id).where("person_id", "=", personId).execute();
    }
    return "applied";
  }

  // Trainings keep the dogs they started with.
  private async setDog(w: Entry, dogId: number, on: boolean): Promise<Outcome> {
    if (on) {
      if (!(await this.activeDogs()).includes(dogId)) return "dropped";
      await this.tx.insertInto("entry_dog").values({ entry_id: w.id, dog_id: dogId }).onConflict((oc) => oc.doNothing()).execute();
    } else {
      if (!keepsOne(w.dogIds, dogId)) return "dropped";
      await this.tx.deleteFrom("entry_dog").where("entry_id", "=", w.id).where("dog_id", "=", dogId).execute();
    }
    return "applied";
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
    if (training && withinWalk(training.at, w.at, end)) await this.end(training, end);
    return "applied";
  }

  private async rep(t: Entry, exerciseId: number, dogId: number, ok: boolean, delta: 1 | -1): Promise<Outcome> {
    if (!t.dogIds.includes(dogId)) return "dropped";
    const exists = await this.tx.selectFrom("exercise").select("id").where("id", "=", exerciseId).executeTakeFirst();
    if (!exists) return "dropped";
    const row = await this.tx.selectFrom("training_exercise").select(["ok_count", "fail_count"]).where("entry_id", "=", t.id).where("exercise_id", "=", exerciseId).where("dog_id", "=", dogId).executeTakeFirst();
    const counts = { ok_count: row?.ok_count ?? 0, fail_count: row?.fail_count ?? 0 };
    const field = ok ? "ok_count" : "fail_count";
    counts[field] = Math.max(0, counts[field] + delta);
    await this.tx
      .insertInto("training_exercise")
      .values({ entry_id: t.id, exercise_id: exerciseId, dog_id: dogId, ...counts })
      .onConflict((oc) => oc.columns(["entry_id", "exercise_id", "dog_id"]).doUpdateSet(counts))
      .execute();
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
