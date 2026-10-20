// The use cases the screens, the export and the API call: log, edit and delete entries, the today view and the
// history. It hides the database, the one dog of 0.1, the time zone and display names (of everyone who has signed in). Input from outside is
// validated here (zod); a problem is an InputError with a German message the screen can show.
import { sql } from "kysely";
import { z } from "zod";
import { computeStock, dayBounds, dogRule, type Entry, entryFields, type EntryType, FOOD_KINDS, type FoodKind, isEntryType, latestByType, mondayOf, newEntryInput, type Stock, TILE_TYPES, weekBounds, type WeekInput, type WeekView, weekView } from "@gassi/domain";
import type { User } from "./auth/session";
import { config } from "./config";
import { database, type DB } from "./db/open";
import { DogRepository } from "./dogs";
import { EntryRepository } from "./entries/repository";
import { InputError } from "./errors";
import { type Names, PeopleRepository } from "./people";
import { pausedWithin, Sessions, type SessionsView } from "./sessions";
import { dryTreats } from "./stock";

/** An entry as the screens show it: with the display name of whoever logged it, and for walks the walkers' names and
 * minutes paused, for trainings the exercises practised and treats given. */
export type EntryView = Entry & { byName: string; walkers: string[]; pauseMin: number | null; exercises: string[]; treats: number | null };

export type TodayView = {
  timeZone: string;
  now: string;
  tiles: Record<(typeof TILE_TYPES)[number], EntryView | null>;
  entries: EntryView[];
  sessions: SessionsView; // the walk and training running now
  lastFood: Record<FoodKind, number | null>; // the usual portions, for the food sheet
};

export type HistoryFilter = { type?: EntryType; by?: string; day?: string };
export type HistoryPage = { entries: EntryView[]; more: boolean };

export const HISTORY_PAGE = 50;


export { InputError };

const MESSAGES: Record<string, string> = {
  at: "Die Zeit fehlt oder stimmt nicht.",
  endedAt: "Das Ende fehlt, stimmt nicht oder liegt vor dem Anfang.",
  amountG: "Die Menge muss eine ganze Zahl Gramm sein.",
  foodKind: "Diese Futterart gibt es nicht.",
  unitG: "Die Dosengröße muss eine ganze Zahl Gramm sein (1 bis 10000).",
  note: "Die Notiz ist zu lang (höchstens 1000 Zeichen).",
  type: "Diese Art von Eintrag gibt es nicht.",
};

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const field = String(result.error.issues[0]?.path[0] ?? "");
  throw new InputError(MESSAGES[field] ?? "Die Eingabe stimmt nicht.");
}

const restockInput = z.union([
  z.object({ foodKind: z.literal("wet"), cans: z.coerce.number().int().min(1).max(1000), unitG: z.coerce.number().int().min(1).max(10_000) }),
  z.object({ foodKind: z.literal("dry"), grams: z.coerce.number().int().min(1).max(1_000_000) }),
]);

const stockInput = z.union([
  z.object({ foodKind: z.literal("wet"), cans: z.coerce.number().min(0).max(1000) }),
  z.object({ foodKind: z.literal("dry"), grams: z.coerce.number().int().min(0).max(1_000_000) }),
]);

const weightInput = z.object({
  kg: z.preprocess((v) => (typeof v === "string" ? (v.trim() ? Number(v.trim().replace(",", ".")) : NaN) : v), z.number().min(0.5).max(100)),
  at: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
});

// Food, restocks and stock counts belong to one kind: without it they would count for neither stock.
const needsKind = (type: EntryType, kind: FoodKind | null) => {
  if (!kind && (type === "food" || type === "restock" || type === "stockcheck")) throw new InputError("Welche Futterart?");
};

const foodKindOf = (input: unknown): FoodKind => {
  const kind = (input as { foodKind?: unknown } | null)?.foodKind;
  if (!FOOD_KINDS.includes(kind as FoodKind)) throw new InputError("Diese Futterart gibt es nicht.");
  return kind as FoodKind;
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

  /** Everyone who has signed in, for the person filter. */
  people(): { id: string; name: string }[] {
    return [...this.deps.names].map(([id, name]) => ({ id, name }));
  }

  /** The history filter from untrusted values (search params, an action's argument): anything unknown is left out. */
  filter(raw: { type?: unknown; by?: unknown; day?: unknown }): HistoryFilter {
    return {
      ...(isEntryType(raw.type) ? { type: raw.type } : {}),
      ...(typeof raw.by === "string" && this.deps.names.has(raw.by) ? { by: raw.by } : {}),
      ...(isDay(raw.day) ? { day: raw.day } : {}),
    };
  }

  async log(user: User, input: unknown): Promise<EntryView> {
    const fields = parse(newEntryInput, input);
    needsKind(fields.type, fields.foodKind);
    return this.view1(await this.entries.create({ ...fields, dogIds: fields.dogIds ?? (await this.defaultDogs(fields.type)), loggedBy: user.id }));
  }

  /** Logs on behalf of `loggedBy` (the API): someone who has signed in at least once. */
  async logAs(loggedBy: string, input: unknown): Promise<EntryView> {
    const name = this.deps.names.get(loggedBy);
    if (!name) throw new InputError("Diese Person gibt es nicht.");
    return this.log({ id: loggedBy, name }, input);
  }

  async edit(id: number, input: unknown): Promise<EntryView | null> {
    const fields = parse(entryFields, input);
    const before = await this.entries.get(id);
    if (before) needsKind(before.type, fields.foodKind);
    // without an end it would run again (it was started on the walk screen); a walk logged afterwards may lose its end
    if (before?.clientKey && before.endedAt && !fields.endedAt) throw new InputError(before.type === "walk" ? "Eine beendete Runde braucht ein Ende." : "Ein beendetes Training braucht ein Ende.");
    const entry = await this.entries.update(id, fields);
    return entry ? this.view1(entry) : null;
  }

  remove(id: number): Promise<boolean> {
    return this.entries.remove(id);
  }

  async today(): Promise<TodayView> {
    const now = this.deps.now();
    const { start, end } = dayBounds(now.getTime(), this.deps.timeZone);
    const entries = await this.views(await this.entries.list({ since: iso(start), until: iso(end) }));
    const latest = latestByType(entries);
    const tiles = Object.fromEntries(TILE_TYPES.map((t) => [t, (latest[t] as EntryView | undefined) ?? null])) as TodayView["tiles"];
    const [sessions, lastFood] = await Promise.all([new Sessions(this.deps).current(), this.lastFoodAmounts()]);
    return { timeZone: this.deps.timeZone, now: now.toISOString(), tiles, entries, sessions, lastFood };
  }

  /** The amount of the newest feeding of each kind, offered as the usual portion. */
  async lastFoodAmounts(): Promise<Record<FoodKind, number | null>> {
    const food = await this.entries.list({ type: "food" });
    const last = (kind: FoodKind) => food.find((e) => e.foodKind === kind)?.amountG ?? null;
    return { wet: last("wet"), dry: last("dry") };
  }

  /** Bought food: wet as cans × grams per can, dry in grams. */
  async restock(user: User, input: unknown): Promise<EntryView> {
    const kind = foodKindOf(input);
    const r = restockInput.safeParse(input);
    if (!r.success) throw new InputError(kind === "wet" ? "Wie viele Dosen, und wie viel Gramm hat eine Dose?" : "Wie viel Gramm hast du gekauft?");
    const amount = r.data.foodKind === "wet" ? { amountG: r.data.cans * r.data.unitG, unitG: r.data.unitG } : { amountG: r.data.grams, unitG: null };
    return this.create(user, { type: "restock", foodKind: kind, ...amount });
  }

  /** What is there now, counted by hand: wet in cans (of the last can size bought), dry in grams. */
  async correctStock(user: User, input: unknown): Promise<EntryView> {
    const kind = foodKindOf(input);
    const r = stockInput.safeParse(input);
    if (!r.success) throw new InputError(kind === "wet" ? "Wie viele Dosen sind noch da?" : "Wie viel Gramm sind noch da?");
    let grams: number;
    if (r.data.foodKind === "wet") {
      const canSizeG = (await this.stock()).wet.canSizeG;
      if (!canSizeG) throw new InputError("Trag erst einen Einkauf mit Dosengröße ein.");
      grams = Math.round(r.data.cans * canSizeG);
    } else grams = r.data.grams;
    return this.create(user, { type: "stockcheck", foodKind: kind, amountG: grams, unitG: null });
  }

  /** Toffee's weight in kg (one decimal), stored as grams. */
  async logWeight(user: User, input: unknown): Promise<EntryView> {
    const r = weightInput.safeParse(input);
    if (!r.success) throw new InputError(r.error.issues[0]?.path[0] === "at" ? MESSAGES.at : "Das Gewicht muss zwischen 0,5 und 100 kg liegen.");
    const amountG = Math.round(r.data.kg * 10) * 100;
    return this.view1(await this.entries.create({ type: "weight", at: r.data.at, endedAt: null, amountG, foodKind: null, unitG: null, note: null, dogIds: await this.defaultDogs("weight"), loggedBy: user.id }));
  }

  async stock(): Promise<Stock> {
    const [entries, treats] = await Promise.all([this.entries.list({}), dryTreats(this.deps.db)]);
    return computeStock({ entries, treats, now: this.deps.now().getTime() });
  }

  private async create(user: User, e: { type: EntryType; foodKind: FoodKind; amountG: number; unitG: number | null }): Promise<EntryView> {
    const at = this.deps.now().toISOString();
    return this.view1(await this.entries.create({ ...e, at, endedAt: null, note: null, dogIds: [], loggedBy: user.id }));
  }

  async history(filter: HistoryFilter, offset = 0): Promise<HistoryPage> {
    const day = filter.day ? dayBounds(Date.parse(`${filter.day}T12:00:00Z`), this.deps.timeZone) : null;
    const rows = await this.entries.list({ type: filter.type, loggedBy: filter.by, ...(day ? { since: iso(day.start), until: iso(day.end), overlapping: true } : {}), offset, limit: HISTORY_PAGE + 1 });
    return { entries: await this.views(rows.slice(0, HISTORY_PAGE)), more: rows.length > HISTORY_PAGE };
  }

  /** The week starting on the Monday of `day` ("2026-10-21" → that week), this week for anything else. */
  async week(day: unknown): Promise<WeekView> {
    const { db, timeZone, names } = this.deps;
    const now = this.deps.now().getTime();
    const monday = isDay(day) ? mondayOf(Date.parse(`${day}T12:00:00Z`), timeZone) : mondayOf(now, timeZone);
    const { start, end } = weekBounds(monday, timeZone);
    // with walks that began before Monday and went on into the week
    const entries = await this.entries.list({ since: iso(start), until: iso(end), overlapping: true });
    const ids = (type: EntryType) => entries.filter((e) => e.type === type).map((e) => e.id);
    const [walkIds, trainingIds] = [ids("walk"), ids("training")];
    const [walkerRows, exerciseRows, treatRows] = await Promise.all([
      walkIds.length ? db.selectFrom("walk_walker").select(["entry_id", "person_id"]).where("entry_id", "in", walkIds).execute() : [],
      trainingIds.length ? db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["entry_id", "exercise.name"]).where("entry_id", "in", trainingIds).execute() : [],
      trainingIds.length ? db.selectFrom("training_treat").select(["entry_id", "count"]).where("entry_id", "in", trainingIds).execute() : [],
    ]);
    const walkers: WeekInput["walkers"] = {};
    for (const r of walkerRows) (walkers[r.entry_id] ??= []).push(r.person_id);
    const trainings: WeekInput["trainings"] = Object.fromEntries(trainingIds.map((id) => [id, { exercises: [] as string[], treats: 0 }]));
    for (const r of exerciseRows) trainings[r.entry_id].exercises.push(r.name);
    for (const r of treatRows) trainings[r.entry_id].treats += r.count;
    return weekView({ entries, walkers, trainings, names, monday, timeZone, now });
  }

  async all(query: { type?: EntryType; since?: string } = {}): Promise<EntryView[]> {
    return this.views(await this.entries.list({ ...query }));
  }

  // Until entries name their dogs (step 1, task 7): every active dog, or the first for one-dog types.
  private async defaultDogs(type: EntryType): Promise<number[]> {
    const rule = dogRule(type);
    if (rule === "none") return [];
    const ids = await new DogRepository(this.deps.db).activeIds();
    return rule === "one" ? ids.slice(0, 1) : ids;
  }

  private async view1(e: Entry): Promise<EntryView> {
    return (await this.views([e]))[0];
  }

  // Loads the walkers, pauses, exercises and treats of the walks and trainings among `entries` in one go.
  private async views(entries: Entry[]): Promise<EntryView[]> {
    const { db, names } = this.deps;
    const ids = (type: EntryType) => entries.filter((e) => e.type === type).map((e) => e.id);
    const [walkIds, trainingIds] = [ids("walk"), ids("training")];
    const [walkers, pauses, exercises, treats] = await Promise.all([
      walkIds.length ? db.selectFrom("walk_walker").select(["entry_id", "person_id"]).where("entry_id", "in", walkIds).orderBy(sql`rowid`).execute() : [],
      walkIds.length ? db.selectFrom("walk_pause").select(["entry_id", "started_at", "ended_at"]).where("entry_id", "in", walkIds).execute() : [],
      trainingIds.length ? db.selectFrom("training_exercise").innerJoin("exercise", "exercise.id", "training_exercise.exercise_id").select(["entry_id", "exercise.name"]).where("entry_id", "in", trainingIds).orderBy(sql`training_exercise.rowid`).execute() : [],
      trainingIds.length ? db.selectFrom("training_treat").select(["entry_id", "count"]).where("entry_id", "in", trainingIds).execute() : [],
    ]);
    const now = this.deps.now().toISOString();
    return entries.map((e) => {
      const isWalk = e.type === "walk";
      const pauseMs = pausedWithin(
        pauses.filter((p) => p.entry_id === e.id).map((p) => ({ startedAt: p.started_at, endedAt: p.ended_at })),
        e.at,
        e.endedAt ?? now,
      );
      return {
        ...e,
        byName: names.get(e.loggedBy) ?? e.loggedBy,
        walkers: walkers.filter((w) => w.entry_id === e.id).map((w) => names.get(w.person_id) ?? w.person_id),
        pauseMin: isWalk && pauses.some((p) => p.entry_id === e.id) ? Math.round(pauseMs / 60_000) : isWalk && e.clientKey ? 0 : null,
        exercises: exercises.filter((x) => x.entry_id === e.id).map((x) => x.name),
        treats: e.type === "training" ? treats.filter((t) => t.entry_id === e.id).reduce((n, t) => n + t.count, 0) : null,
      };
    });
  }

}

const iso = (ms: number) => new Date(ms).toISOString();

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

/** The diary for one request, on the configured database and dog, with the names as they are now. */
export async function diary(): Promise<Diary> {
  const db = await database();
  const names = await new PeopleRepository(db).names();
  return new Diary({ db, names, timeZone: config().timeZone, now: () => new Date() });
}
