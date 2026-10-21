// The use cases of the diary: log, edit and delete entries (for the right dogs), the history, food and stock,
// weight and the week. It hides the database, the time zone and display names. Input from outside is validated here
// (zod); a problem is an InputError with a German message the app can show.
import { sql } from "kysely";
import { z } from "zod";
import { checkDogs, computeStock, dayBounds, dogRule, type Entry, ENTRY_MESSAGES, entryEditFields, type EntryType, type ExerciseTotal, exerciseTotals, type FieldMessages, type FoodKind, isEntryType, messageFor, mondayOf, newEntryInput, pausedWithin, type Rep, RESTOCK_MESSAGES, restockInput, type Route, simplify, type Stock, STOCK_COUNT_MESSAGES, stockCountInput, trainingEditInput, type WalkDuring, weekBounds, withinWalk, type WeekInput, weekView, type WeekView, WEIGHT_MESSAGES, weightInput } from "@gassi/domain";
import type { DB } from "./db/open";
import { DogRepository } from "./dogs";
import { EntryRepository } from "./entries/repository";
import { InputError } from "./errors";
import type { Names, Person } from "./people";
import { dryTreats } from "./stock";
import { type ShownTrack, Tracks } from "./tracks";

/** An entry as the screens show it: with the display name of whoever logged it, and for walks the walkers (names and
 * ids), minutes paused, the distance and a thumbnail route of the shown track and what happened during it, for trainings the exercises practised
 * and treats given, in total and as editTraining takes them (repetitions per exercise and dog, treats per kind). */
export type EntryView = Entry & {
  byName: string;
  walkers: string[];
  walkerIds: string[];
  pauseMin: number | null;
  exercises: ExerciseTotal[];
  treats: number | null;
  reps: Rep[];
  treatCounts: TreatCount[];
  distanceM: number | null;
  route: Route | null;
  during: WalkDuring | null;
  count: CountRow[] | null;
};
/** One can size of a wet count. */
export type CountRow = { unitG: number; amountG: number };

// A wet count is one stockcheck per can size at the same time: its rows are moved and deleted together.
const isWetCount = (e: Entry) => e.type === "stockcheck" && e.foodKind === "wet";
export type TreatCount = { treatKindId: number; count: number };


/** What the walks and trainings among some entries have, by entry id. */
type Details = {
  walkers: Map<number, string[]>;
  pauses: Map<number, { startedAt: string; endedAt: string | null }[]>;
  exercises: Map<number, ExerciseTotal[]>;
  reps: Map<number, Rep[]>;
  treats: Map<number, number>;
  treatCounts: Map<number, TreatCount[]>;
  tracks: Map<number, ShownTrack>;
  during: Map<number, WalkDuring>;
};

/** The newest entry of the types the Start screen shows. */
export type Today = Record<"walk" | "food" | "pee" | "poop", EntryView | null>;

const ROUTE_POINTS = 64;

export type HistoryFilter = { type?: EntryType; by?: string; day?: string; dog?: number };
export type HistoryPage = { entries: EntryView[]; more: boolean };

export const HISTORY_PAGE = 50;


export { InputError };

/** Checks `input` with `schema`; a problem becomes an InputError with the field's German message. */
function parse<S extends z.ZodType>(schema: S, input: unknown, messages: FieldMessages): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new InputError(messageFor(messages, result.error));
}

// Food, restocks and stock counts belong to one kind: without it they would count for neither stock.
const needsKind = (type: EntryType, kind: FoodKind | null) => {
  if (!kind && (type === "food" || type === "restock" || type === "stockcheck")) throw new InputError("Welche Futterart?");
};

export type DiaryDeps = { db: DB; names: Names; timeZone: string; now: () => Date };

export class Diary {
  private readonly entries: EntryRepository;

  constructor(private readonly deps: DiaryDeps) {
    this.entries = new EntryRepository(deps.db, deps.now);
  }

  get timeZone(): string {
    return this.deps.timeZone;
  }

  /** The history filter from untrusted values (search params, an action's argument): anything unknown is left out. */
  filter(raw: { type?: unknown; by?: unknown; day?: unknown; dog?: unknown }): HistoryFilter {
    return {
      ...(isEntryType(raw.type) ? { type: raw.type } : {}),
      ...(typeof raw.by === "string" && this.deps.names.has(raw.by) ? { by: raw.by } : {}),
      ...(isDay(raw.day) ? { day: raw.day } : {}),
      ...(/^[1-9]\d*$/.test(String(raw.dog ?? "")) ? { dog: Number(raw.dog) } : {}),
    };
  }

  async log(user: Person, input: unknown): Promise<EntryView> {
    const fields = parse(newEntryInput, input, ENTRY_MESSAGES);
    needsKind(fields.type, fields.foodKind);
    return this.view1(await this.entries.create({ ...fields, dogIds: await this.dogsFor(fields.type, fields.dogIds), loggedBy: user.id }));
  }

  async edit(id: number, input: unknown): Promise<EntryView | null> {
    const { walkers, ...fields } = parse(entryEditFields, input, ENTRY_MESSAGES);
    const before = await this.entries.get(id);
    if (before) needsKind(before.type, fields.foodKind);
    if (before && fields.dogIds) fields.dogIds = await this.dogsFor(before.type, fields.dogIds, before.dogIds);
    if (before && walkers) {
      if (before.type !== "walk") throw new InputError("Mitgeher gibt es nur bei Runden.");
      if (walkers.some((p) => !this.deps.names.has(p))) throw new InputError("Diese Person gibt es nicht.");
    }
    // without an end it would run again (it was started on the walk screen); a walk logged afterwards may lose its end
    if (before?.clientKey && before.endedAt && !fields.endedAt) throw new InputError(before.type === "walk" ? "Eine beendete Runde braucht ein Ende." : "Ein beendetes Training braucht ein Ende.");
    // a count moved onto another count's time would become one count with that one's sizes twice
    if (before && isWetCount(before) && fields.at && new Date(fields.at).toISOString() !== before.at) {
      const at = new Date(fields.at).toISOString();
      const taken = await this.deps.db.selectFrom("entry").select("id").where("type", "=", "stockcheck").where("food_kind", "=", "wet").where("at", "=", at).executeTakeFirst();
      if (taken) throw new InputError("Zu dieser Zeit gibt es schon eine Zählung.");
    }
    // the entry and its walkers change together or not at all
    const entry = await this.deps.db.transaction().execute(async (tx) => {
      const updated = await new EntryRepository(tx, this.deps.now).update(id, fields);
      // the other sizes of a wet count go to the same time (else the count would set them to 0, or lose this one)
      if (updated && before && isWetCount(before) && updated.at !== before.at) {
        await tx.updateTable("entry").set({ at: updated.at, updated_at: this.deps.now().toISOString() }).where("type", "=", "stockcheck").where("food_kind", "=", "wet").where("at", "=", before.at).where("id", "!=", id).execute();
      }
      if (updated && walkers) await replaceWalkers(tx, id, [...new Set(walkers)]);
      // a dog taken out of a training takes its repetitions along
      if (updated?.type === "training" && fields.dogIds) await tx.deleteFrom("training_exercise").where("entry_id", "=", id).where("dog_id", "not in", fields.dogIds).execute();
      return updated;
    });
    return entry ? this.view1(entry) : null;
  }

  /** Replaces a training's repetitions and treats afterwards (the Verlauf's fix-ups); null if there is no such entry. */
  async editTraining(id: number, input: unknown): Promise<EntryView | null> {
    const { reps, treats } = parse(trainingEditInput.omit({ id: true }), input, ENTRY_MESSAGES);
    const training = await this.entries.get(id);
    if (!training) return null;
    if (training.type !== "training") throw new InputError("Das ist kein Training.");
    const { db } = this.deps;
    const [exerciseIds, kinds] = await Promise.all([
      db.selectFrom("exercise").select("id").execute(),
      db.selectFrom("treat_kind").select(["id", "grams_per_piece", "from_dry"]).execute(),
    ]);
    // treats already given keep the grams and dry flag they were logged with
    const given = await db.selectFrom("training_treat").selectAll().where("entry_id", "=", id).execute();
    // the same exercise and dog (or treat kind) twice add up
    const repRows = new Map<string, { exercise_id: number; dog_id: number; ok_count: number; fail_count: number }>();
    for (const r of reps) {
      if (!training.dogIds.includes(r.dogId)) throw new InputError("Dieser Hund gehört nicht zum Training.");
      if (!exerciseIds.some((x) => x.id === r.exerciseId)) throw new InputError("Diese Übung gibt es nicht.");
      const row = repRows.get(`${r.exerciseId}/${r.dogId}`) ?? { exercise_id: r.exerciseId, dog_id: r.dogId, ok_count: 0, fail_count: 0 };
      repRows.set(`${r.exerciseId}/${r.dogId}`, { ...row, ok_count: row.ok_count + r.ok, fail_count: row.fail_count + r.fail });
    }
    const treatCounts = new Map<number, number>();
    for (const t of treats) {
      if (!kinds.some((k) => k.id === t.treatKindId)) throw new InputError("Diese Leckerli-Art gibt es nicht.");
      treatCounts.set(t.treatKindId, (treatCounts.get(t.treatKindId) ?? 0) + t.count);
    }
    await db.transaction().execute(async (tx) => {
      await tx.updateTable("entry").set({ updated_at: this.deps.now().toISOString() }).where("id", "=", id).execute();
      await tx.deleteFrom("training_exercise").where("entry_id", "=", id).execute();
      await tx.deleteFrom("training_treat").where("entry_id", "=", id).execute();
      const exerciseRows = [...repRows.values()].filter((r) => r.ok_count > 0 || r.fail_count > 0).map((r) => ({ entry_id: id, ...r }));
      if (exerciseRows.length) await tx.insertInto("training_exercise").values(exerciseRows).execute();
      const treatRows = [...treatCounts].filter(([, count]) => count > 0).map(([kindId, count]) => {
        const kind = given.find((g) => g.treat_kind_id === kindId) ?? kinds.find((k) => k.id === kindId)!;
        return { entry_id: id, treat_kind_id: kindId, count, grams_per_piece: kind.grams_per_piece, from_dry: kind.from_dry };
      });
      if (treatRows.length) await tx.insertInto("training_treat").values(treatRows).execute();
    });
    return this.view1((await this.entries.get(id))!);
  }

  /** One entry as the screens show it, or null if there is none. */
  async get(id: number): Promise<EntryView | null> {
    const entry = await this.entries.get(id);
    return entry ? this.view1(entry) : null;
  }

  /** Deletes the entry; a wet count's row takes the whole count along. */
  async remove(id: number): Promise<boolean> {
    const e = await this.entries.get(id);
    if (!e) return false;
    if (!isWetCount(e)) return this.entries.remove(id);
    await this.deps.db.deleteFrom("entry").where("type", "=", "stockcheck").where("food_kind", "=", "wet").where("at", "=", e.at).execute();
    return true;
  }

  /** The amount of the newest feeding of each kind, offered as the usual portion, and the can size of the newest wet
   * feeding that named one, offered as the can to feed from. */
  async lastFoodAmounts(): Promise<Record<FoodKind, number | null> & { wetUnitG: number | null }> {
    const food = await this.entries.list({ type: "food" });
    const last = (kind: FoodKind) => food.find((e) => e.foodKind === kind)?.amountG ?? null;
    return { wet: last("wet"), dry: last("dry"), wetUnitG: food.find((e) => e.foodKind === "wet" && e.unitG)?.unitG ?? null };
  }

  /** Bought food: wet as cans × grams per can, one restock per can size (together), dry in grams. */
  async restock(user: Person, input: unknown): Promise<{ entries: EntryView[] }> {
    const r = parse(restockInput, input, RESTOCK_MESSAGES);
    const rows = r.foodKind === "wet" ? r.sizes.map((s) => ({ amountG: s.cans * s.unitG, unitG: s.unitG })) : [{ amountG: r.grams, unitG: null }];
    return this.createAll(user, "restock", r.foodKind, rows);
  }

  /** What is there now, counted by hand: wet in cans per can size, one entry per size at the same time (a size left
   * out is 0 from then on), dry in grams. */
  async correctStock(user: Person, input: unknown): Promise<{ entries: EntryView[] }> {
    const r = parse(stockCountInput, input, STOCK_COUNT_MESSAGES);
    const rows = r.foodKind === "wet" ? r.sizes.map((s) => ({ amountG: Math.round(s.cans * s.unitG), unitG: s.unitG })) : [{ amountG: r.grams, unitG: null }];
    return this.createAll(user, "stockcheck", r.foodKind, rows);
  }

  /** Restocks or stock counts of one kind, at the same time, in one transaction. */
  private async createAll(user: Person, type: "restock" | "stockcheck", foodKind: FoodKind, rows: readonly { amountG: number; unitG: number | null }[]): Promise<{ entries: EntryView[] }> {
    const at = this.deps.now().toISOString();
    const entries = await this.deps.db.transaction().execute(async (tx) => {
      const repo = new EntryRepository(tx, this.deps.now);
      const made: Entry[] = [];
      for (const row of rows) made.push(await repo.create({ type, foodKind, ...row, at, endedAt: null, note: null, dogIds: [], loggedBy: user.id }));
      return made;
    });
    return { entries: await this.views(entries) };
  }

  /** A dog's weight in kg (one decimal), stored as grams; the time defaults to now. */
  async logWeight(user: Person, input: unknown): Promise<EntryView> {
    const r = parse(weightInput, input, WEIGHT_MESSAGES);
    const amountG = Math.round(r.kg * 10) * 100;
    const at = r.at ?? this.deps.now().toISOString();
    return this.view1(await this.entries.create({ type: "weight", at, endedAt: null, amountG, foodKind: null, unitG: null, note: null, dogIds: await this.dogsFor("weight", r.dogIds), loggedBy: user.id }));
  }

  async stock(): Promise<Stock> {
    const [entries, treats] = await Promise.all([this.entries.list({}), dryTreats(this.deps.db)]);
    return computeStock({ entries, treats, now: this.deps.now().getTime() });
  }

  async history(filter: HistoryFilter, offset = 0): Promise<HistoryPage> {
    const day = filter.day ? dayBounds(Date.parse(`${filter.day}T12:00:00Z`), this.deps.timeZone) : null;
    const rows = await this.entries.list({ type: filter.type, by: filter.by, dogId: filter.dog, ...(day ? { since: iso(day.start), until: iso(day.end), overlapping: true } : {}), offset, limit: HISTORY_PAGE + 1 });
    return { entries: await this.views(rows.slice(0, HISTORY_PAGE)), more: rows.length > HISTORY_PAGE };
  }

  /** The week starting on the Monday of `day` ("2026-10-21" → that week), this week for anything else. */
  async week(day: unknown): Promise<WeekView> {
    const { timeZone, names } = this.deps;
    const now = this.deps.now().getTime();
    const monday = isDay(day) ? mondayOf(Date.parse(`${day}T12:00:00Z`), timeZone) : mondayOf(now, timeZone);
    const { start, end } = weekBounds(monday, timeZone);
    // with walks that began before Monday and went on into the week
    const entries = await this.entries.list({ since: iso(start), until: iso(end), overlapping: true });
    const d = await this.details(entries);
    const walkers = Object.fromEntries(d.walkers);
    const trainings: WeekInput["trainings"] = Object.fromEntries(entries.filter((e) => e.type === "training").map((e) => [e.id, { exercises: d.exercises.get(e.id) ?? [], treats: d.treats.get(e.id) ?? 0 }]));
    const tracks: WeekInput["tracks"] = Object.fromEntries([...d.tracks].map(([id, t]) => [id, { distanceM: t.metrics.distanceM, route: simplify(t.points, ROUTE_POINTS) }]));
    return weekView({ entries, walkers, trainings, tracks, names, monday, timeZone, now });
  }

  /** The newest walk, feeding, pee and poop (null where there is none yet). */
  async today(): Promise<Today> {
    const types = ["walk", "food", "pee", "poop"] as const;
    const newest = await Promise.all(types.map(async (type) => (await this.entries.list({ type, limit: 1 }))[0]));
    const views = await this.views(newest.filter((e) => e !== undefined));
    return Object.fromEntries(types.map((type) => [type, views.find((v) => v.type === type) ?? null])) as Today;
  }

  async all(query: { type?: EntryType; since?: string } = {}): Promise<EntryView[]> {
    return this.views(await this.entries.list({ ...query }));
  }

  /** The dogs an entry of `type` is for: the named ones (active, fitting the type), else the default: no dog for
   * restocks and notes, all active dogs for walks, trainings and food, the only dog for pee/poop/weight if there is one.
   * `kept`: dogs an edited entry already has, allowed even when archived since. */
  private async dogsFor(type: EntryType, requested: number[] | undefined, kept: readonly number[] = []): Promise<number[]> {
    const rule = dogRule(type);
    const active = await new DogRepository(this.deps.db).activeIds();
    if (requested === undefined) {
      if (rule === "none") return [];
      if (rule === "some" || active.length === 1) return active;
      throw new InputError("Für welchen Hund?");
    }
    if (requested.some((id) => !active.includes(id) && !kept.includes(id))) throw new InputError("Diesen Hund gibt es nicht.");
    const problem = checkDogs(type, requested);
    if (problem) throw new InputError(problem);
    return [...new Set(requested)];
  }

  private async view1(e: Entry): Promise<EntryView> {
    return (await this.views([e]))[0];
  }

  // Loads what the walks and trainings among `entries` have (walkers, pauses, repetitions, treats, the shown track),
  // grouped by entry id.
  private async details(entries: readonly Entry[]): Promise<Details> {
    const { db } = this.deps;
    const ids = (type: EntryType) => entries.filter((e) => e.type === type).map((e) => e.id);
    const [walkIds, trainingIds] = [ids("walk"), ids("training")];
    const [walkers, pauses, exercises, treats, tracks, during] = await Promise.all([
      walkIds.length ? db.selectFrom("walk_walker").select(["entry_id", "person_id"]).where("entry_id", "in", walkIds).orderBy(sql`rowid`).execute() : [],
      walkIds.length ? db.selectFrom("walk_pause").select(["entry_id", "started_at", "ended_at"]).where("entry_id", "in", walkIds).execute() : [],
      trainingIds.length ? db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["entry_id", "exercise_id", "dog_id", "exercise.name", "ok_count", "fail_count"]).where("entry_id", "in", trainingIds).orderBy(sql`training_exercise.rowid`).execute() : [],
      trainingIds.length ? db.selectFrom("training_treat").select(["entry_id", "treat_kind_id", "count"]).where("entry_id", "in", trainingIds).where("count", ">", 0).orderBy("treat_kind_id").execute() : [],
      new Tracks(db, this.deps.now).shown(walkIds),
      this.during(entries.filter((e) => e.type === "walk")),
    ]);
    const group = <R extends { entry_id: number }, V>(rows: R[], value: (r: R) => V) => {
      const out = new Map<number, V[]>();
      for (const r of rows) out.set(r.entry_id, [...(out.get(r.entry_id) ?? []), value(r)]);
      return out;
    };
    return {
      walkers: group(walkers, (w) => w.person_id),
      pauses: group(pauses, (p) => ({ startedAt: p.started_at, endedAt: p.ended_at })),
      exercises: new Map([...group(exercises, (x) => ({ name: x.name, ok: x.ok_count, fail: x.fail_count }))].map(([id, rows]) => [id, exerciseTotals(rows)])),
      reps: group(exercises, (x) => ({ exerciseId: x.exercise_id, dogId: x.dog_id, ok: x.ok_count, fail: x.fail_count })),
      treats: new Map([...group(treats, (t) => t.count)].map(([id, counts]) => [id, counts.reduce((n, c) => n + c, 0)])),
      treatCounts: group(treats, (t) => ({ treatKindId: t.treat_kind_id, count: t.count })),
      tracks,
      during,
    };
  }

  // What happened during each walk, decided by time as the walk summary does (ADR 0002): the pee and poop and the
  // trainings begun from its start until its end (now, while it runs), read at once for the time all of them span.
  private async during(walks: readonly Entry[]): Promise<Map<number, WalkDuring>> {
    if (walks.length === 0) return new Map();
    const now = this.deps.now().toISOString();
    const endOf = (w: Entry) => w.endedAt ?? now;
    const since = walks.reduce((min, w) => (w.at < min ? w.at : min), walks[0].at);
    const until = walks.reduce((max, w) => (endOf(w) > max ? endOf(w) : max), endOf(walks[0]));
    const inside = (await this.entries.list({ since, until })).filter((e) => e.type === "pee" || e.type === "poop" || e.type === "training");
    const trainingIds = inside.filter((e) => e.type === "training").map((e) => e.id);
    const reps = trainingIds.length
      ? await this.deps.db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["entry_id", "exercise.name", "ok_count", "fail_count"]).where("entry_id", "in", trainingIds).orderBy(sql`training_exercise.rowid`).execute()
      : [];
    return new Map(
      walks.map((w) => {
        const mine = inside.filter((e) => withinWalk(e.at, w.at, endOf(w)));
        // oldest training first, as the summary lists them
        const trainings = mine.filter((e) => e.type === "training").reverse();
        const rows = trainings.flatMap((t) => reps.filter((r) => r.entry_id === t.id).map((r) => ({ name: r.name, ok: r.ok_count, fail: r.fail_count })));
        const count = (type: EntryType) => mine.filter((e) => e.type === type).length;
        return [w.id, { pees: count("pee"), poops: count("poop"), exercises: exerciseTotals(rows) }];
      }),
    );
  }

  /** The rows of the wet counts among `entries`, by their time, smallest can first. */
  private async counts(entries: readonly Entry[]): Promise<Map<string, CountRow[]>> {
    const ats = [...new Set(entries.filter(isWetCount).map((e) => e.at))];
    if (!ats.length) return new Map();
    const rows = await this.deps.db.selectFrom("entry").select(["at", "unit_g", "amount_g"]).where("type", "=", "stockcheck").where("food_kind", "=", "wet").where("at", "in", ats).orderBy("unit_g").execute();
    const byAt = new Map<string, CountRow[]>();
    for (const r of rows) byAt.set(r.at, [...(byAt.get(r.at) ?? []), { unitG: r.unit_g ?? 0, amountG: r.amount_g ?? 0 }]);
    return byAt;
  }

  private async views(entries: Entry[]): Promise<EntryView[]> {
    const { names } = this.deps;
    const [d, counts] = await Promise.all([this.details(entries), this.counts(entries)]);
    const now = this.deps.now().toISOString();
    return entries.map((e) => {
      const isWalk = e.type === "walk";
      const pauses = d.pauses.get(e.id) ?? [];
      const track = d.tracks.get(e.id);
      return {
        ...e,
        byName: names.get(e.loggedBy) ?? e.loggedBy,
        walkers: (d.walkers.get(e.id) ?? []).map((id) => names.get(id) ?? id),
        walkerIds: d.walkers.get(e.id) ?? [],
        pauseMin: isWalk && pauses.length ? Math.round(pausedWithin(pauses, e.at, e.endedAt ?? now) / 60_000) : isWalk && e.clientKey ? 0 : null,
        exercises: d.exercises.get(e.id) ?? [],
        treats: e.type === "training" ? (d.treats.get(e.id) ?? 0) : null,
        reps: d.reps.get(e.id) ?? [],
        treatCounts: d.treatCounts.get(e.id) ?? [],
        distanceM: track?.metrics.distanceM ?? null,
        route: track ? simplify(track.points, ROUTE_POINTS) : null,
        during: isWalk ? (d.during.get(e.id) ?? null) : null,
        count: isWetCount(e) ? (counts.get(e.at) ?? []) : null,
      };
    });
  }
}

async function replaceWalkers(tx: DB, id: number, personIds: string[]): Promise<void> {
  await tx.deleteFrom("walk_walker").where("entry_id", "=", id).execute();
  await tx.insertInto("walk_walker").values(personIds.map((person_id) => ({ entry_id: id, person_id }))).execute();
}

const iso = (ms: number) => new Date(ms).toISOString();

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
