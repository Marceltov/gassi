// The use cases of the diary: log, edit and delete entries (for the right dogs), the history, food and stock,
// weight and the week. It hides the database, the time zone and display names. Input from outside is validated here
// (zod); a problem is an InputError with a German message the app can show.
import { sql } from "kysely";
import { z } from "zod";
import { checkDogs, computeStock, dayBounds, dogRule, type Entry, ENTRY_MESSAGES, entryFields, type EntryType, type ExerciseTotal, exerciseTotals, type FieldMessages, type FoodKind, isEntryType, messageFor, mondayOf, newEntryInput, pausedWithin, RESTOCK_MESSAGES, restockInput, type Route, simplify, type Stock, STOCK_COUNT_MESSAGES, stockCountInput, weekBounds, type WeekInput, weekView, type WeekView, WEIGHT_MESSAGES, weightInput } from "@gassi/domain";
import type { DB } from "./db/open";
import { DogRepository } from "./dogs";
import { EntryRepository } from "./entries/repository";
import { InputError } from "./errors";
import type { Names, Person } from "./people";
import { dryTreats } from "./stock";
import { type ShownTrack, Tracks } from "./tracks";

/** An entry as the screens show it: with the display name of whoever logged it, and for walks the walkers' names,
 * minutes paused and the distance and a thumbnail route of the shown track, for trainings the exercises practised and treats given. */
export type EntryView = Entry & { byName: string; walkers: string[]; pauseMin: number | null; exercises: ExerciseTotal[]; treats: number | null; distanceM: number | null; route: Route | null };


/** What the walks and trainings among some entries have, by entry id. */
type Details = {
  walkers: Map<number, string[]>;
  pauses: Map<number, { startedAt: string; endedAt: string | null }[]>;
  exercises: Map<number, ExerciseTotal[]>;
  treats: Map<number, number>;
  tracks: Map<number, ShownTrack>;
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
    const fields = parse(entryFields, input, ENTRY_MESSAGES);
    const before = await this.entries.get(id);
    if (before) needsKind(before.type, fields.foodKind);
    if (before && fields.dogIds) fields.dogIds = await this.dogsFor(before.type, fields.dogIds, before.dogIds);
    // without an end it would run again (it was started on the walk screen); a walk logged afterwards may lose its end
    if (before?.clientKey && before.endedAt && !fields.endedAt) throw new InputError(before.type === "walk" ? "Eine beendete Runde braucht ein Ende." : "Ein beendetes Training braucht ein Ende.");
    const entry = await this.entries.update(id, fields);
    return entry ? this.view1(entry) : null;
  }

  remove(id: number): Promise<boolean> {
    return this.entries.remove(id);
  }

  /** The amount of the newest feeding of each kind, offered as the usual portion. */
  async lastFoodAmounts(): Promise<Record<FoodKind, number | null>> {
    const food = await this.entries.list({ type: "food" });
    const last = (kind: FoodKind) => food.find((e) => e.foodKind === kind)?.amountG ?? null;
    return { wet: last("wet"), dry: last("dry") };
  }

  /** Bought food: wet as cans × grams per can, dry in grams. */
  async restock(user: Person, input: unknown): Promise<EntryView> {
    const r = parse(restockInput, input, RESTOCK_MESSAGES);
    const amount = r.foodKind === "wet" ? { amountG: r.cans * r.unitG, unitG: r.unitG } : { amountG: r.grams, unitG: null };
    return this.create(user, { type: "restock", foodKind: r.foodKind, ...amount });
  }

  /** What is there now, counted by hand: wet in cans (of the last can size bought), dry in grams. */
  async correctStock(user: Person, input: unknown): Promise<EntryView> {
    const r = parse(stockCountInput, input, STOCK_COUNT_MESSAGES);
    let grams: number;
    if (r.foodKind === "wet") {
      const canSizeG = (await this.stock()).wet.canSizeG;
      if (!canSizeG) throw new InputError("Trag erst einen Einkauf mit Dosengröße ein.");
      grams = Math.round(r.cans * canSizeG);
    } else grams = r.grams;
    return this.create(user, { type: "stockcheck", foodKind: r.foodKind, amountG: grams, unitG: null });
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

  private async create(user: Person, e: { type: EntryType; foodKind: FoodKind; amountG: number; unitG: number | null }): Promise<EntryView> {
    const at = this.deps.now().toISOString();
    return this.view1(await this.entries.create({ ...e, at, endedAt: null, note: null, dogIds: [], loggedBy: user.id }));
  }

  async history(filter: HistoryFilter, offset = 0): Promise<HistoryPage> {
    const day = filter.day ? dayBounds(Date.parse(`${filter.day}T12:00:00Z`), this.deps.timeZone) : null;
    const rows = await this.entries.list({ type: filter.type, loggedBy: filter.by, dogId: filter.dog, ...(day ? { since: iso(day.start), until: iso(day.end), overlapping: true } : {}), offset, limit: HISTORY_PAGE + 1 });
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

  // Loads what the walks and trainings among `entries` have (walkers, pauses, exercises, treats, the shown track),
  // grouped by entry id.
  private async details(entries: readonly Entry[]): Promise<Details> {
    const { db } = this.deps;
    const ids = (type: EntryType) => entries.filter((e) => e.type === type).map((e) => e.id);
    const [walkIds, trainingIds] = [ids("walk"), ids("training")];
    const [walkers, pauses, exercises, treats, tracks] = await Promise.all([
      walkIds.length ? db.selectFrom("walk_walker").select(["entry_id", "person_id"]).where("entry_id", "in", walkIds).orderBy(sql`rowid`).execute() : [],
      walkIds.length ? db.selectFrom("walk_pause").select(["entry_id", "started_at", "ended_at"]).where("entry_id", "in", walkIds).execute() : [],
      trainingIds.length ? db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["entry_id", "exercise.name", "ok_count", "fail_count"]).where("entry_id", "in", trainingIds).orderBy(sql`training_exercise.rowid`).execute() : [],
      trainingIds.length ? db.selectFrom("training_treat").select(["entry_id", "count"]).where("entry_id", "in", trainingIds).execute() : [],
      new Tracks(db, this.deps.now).shown(walkIds),
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
      treats: new Map([...group(treats, (t) => t.count)].map(([id, counts]) => [id, counts.reduce((n, c) => n + c, 0)])),
      tracks,
    };
  }

  private async views(entries: Entry[]): Promise<EntryView[]> {
    const { names } = this.deps;
    const d = await this.details(entries);
    const now = this.deps.now().toISOString();
    return entries.map((e) => {
      const isWalk = e.type === "walk";
      const pauses = d.pauses.get(e.id) ?? [];
      const track = d.tracks.get(e.id);
      return {
        ...e,
        byName: names.get(e.loggedBy) ?? e.loggedBy,
        walkers: (d.walkers.get(e.id) ?? []).map((id) => names.get(id) ?? id),
        pauseMin: isWalk && pauses.length ? Math.round(pausedWithin(pauses, e.at, e.endedAt ?? now) / 60_000) : isWalk && e.clientKey ? 0 : null,
        exercises: d.exercises.get(e.id) ?? [],
        treats: e.type === "training" ? (d.treats.get(e.id) ?? 0) : null,
        distanceM: track?.metrics.distanceM ?? null,
        route: track ? simplify(track.points, ROUTE_POINTS) : null,
      };
    });
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
