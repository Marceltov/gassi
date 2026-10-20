// The use cases the screens, the export and the API call: log, edit and delete entries, the today view and the
// history. It hides the database, the one dog of v1, the time zone and display names (of everyone who has signed in). Input from outside is
// validated here (zod); a problem is an InputError with a German message the screen can show.
import { z } from "zod";
import { type EntryType, isEntryType, TILE_TYPES } from "../shared/entryTypes";
import { dayBounds } from "../shared/time";
import type { User } from "./auth/session";
import { config } from "./config";
import { database, type DB } from "./db/open";
import { currentDog, type Dog } from "./dogs";
import { type Entry, entryFields, latestByType, newEntryInput } from "./entries/model";
import { EntryRepository } from "./entries/repository";
import { type Names, PeopleRepository } from "./people";

/** An entry as the screens show it: with the display name of whoever logged it. */
export type EntryView = Entry & { byName: string };

export type TodayView = {
  dogName: string;
  timeZone: string;
  now: string;
  tiles: Record<(typeof TILE_TYPES)[number], EntryView | null>;
  entries: EntryView[];
};

export type HistoryFilter = { type?: EntryType; by?: string };
export type HistoryPage = { entries: EntryView[]; more: boolean };

export const HISTORY_PAGE = 50;


export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

const MESSAGES: Record<string, string> = {
  at: "Die Zeit fehlt oder stimmt nicht.",
  durationMin: "Die Dauer muss eine ganze Zahl Minuten sein (1 bis 1440).",
  amountG: "Die Menge muss eine ganze Zahl Gramm sein (1 bis 10000).",
  note: "Die Notiz ist zu lang (höchstens 1000 Zeichen).",
  type: "Diese Art von Eintrag gibt es nicht.",
};

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const field = String(result.error.issues[0]?.path[0] ?? "");
  throw new InputError(MESSAGES[field] ?? "Die Eingabe stimmt nicht.");
}

export type DiaryDeps = { db: DB; dog: Dog; names: Names; timeZone: string; now: () => Date };

export class Diary {
  private readonly entries: EntryRepository;

  constructor(private readonly deps: DiaryDeps) {
    this.entries = new EntryRepository(deps.db, deps.now);
  }

  get dogName(): string {
    return this.deps.dog.name;
  }

  get timeZone(): string {
    return this.deps.timeZone;
  }

  /** Everyone who has signed in, for the person filter. */
  people(): { username: string; name: string }[] {
    return [...this.deps.names].map(([username, name]) => ({ username, name }));
  }

  /** The history filter from untrusted values (search params, an action's argument): anything unknown is left out. */
  filter(raw: { type?: unknown; by?: unknown }): HistoryFilter {
    return {
      ...(isEntryType(raw.type) ? { type: raw.type } : {}),
      ...(typeof raw.by === "string" && this.deps.names.has(raw.by) ? { by: raw.by } : {}),
    };
  }

  async log(user: User, input: unknown): Promise<EntryView> {
    const fields = parse(newEntryInput, input);
    return this.view(await this.entries.create({ ...fields, dogId: this.deps.dog.id, loggedBy: user.username }));
  }

  /** Logs on behalf of `loggedBy` (the API): someone who has signed in at least once. */
  async logAs(loggedBy: string, input: unknown): Promise<EntryView> {
    const name = this.deps.names.get(loggedBy);
    if (!name) throw new InputError("Diese Person gibt es nicht.");
    return this.log({ username: loggedBy, name }, input);
  }

  async edit(id: number, input: unknown): Promise<EntryView | null> {
    const entry = await this.entries.update(id, parse(entryFields, input));
    return entry ? this.view(entry) : null;
  }

  remove(id: number): Promise<boolean> {
    return this.entries.remove(id);
  }

  async today(): Promise<TodayView> {
    const now = this.deps.now();
    const { start, end } = dayBounds(now.getTime(), this.deps.timeZone);
    const entries = (await this.entries.list({ dogId: this.deps.dog.id, since: iso(start), until: iso(end) })).map((e) => this.view(e));
    const latest = latestByType(entries);
    const tiles = Object.fromEntries(TILE_TYPES.map((t) => [t, (latest[t] as EntryView | undefined) ?? null])) as TodayView["tiles"];
    return { dogName: this.deps.dog.name, timeZone: this.deps.timeZone, now: now.toISOString(), tiles, entries };
  }

  async history(filter: HistoryFilter, offset = 0): Promise<HistoryPage> {
    const rows = await this.entries.list({ dogId: this.deps.dog.id, type: filter.type, loggedBy: filter.by, offset, limit: HISTORY_PAGE + 1 });
    return { entries: rows.slice(0, HISTORY_PAGE).map((e) => this.view(e)), more: rows.length > HISTORY_PAGE };
  }

  async all(query: { type?: EntryType; since?: string } = {}): Promise<EntryView[]> {
    return (await this.entries.list({ dogId: this.deps.dog.id, ...query })).map((e) => this.view(e));
  }

  private view(e: Entry): EntryView {
    return { ...e, byName: this.deps.names.get(e.loggedBy) ?? e.loggedBy };
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** The diary for one request, on the configured database and dog, with the names as they are now. */
export async function diary(): Promise<Diary> {
  const db = await database();
  const [dog, names] = await Promise.all([currentDog(db), new PeopleRepository(db).names()]);
  return new Diary({ db, dog, names, timeZone: config().timeZone, now: () => new Date() });
}
