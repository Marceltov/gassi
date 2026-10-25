// The implementations of the API contract, each a thin call into a use case.
import type { ClientEventWants } from "@gassi/api-client";
import { Devices } from "../auth/devices";
import { appLink, INVITE_TTL, type LinkKey, Links, WrongLink } from "../auth/links";
import { type Mailer, sendMagicLink } from "../auth/mail";
import type { Throttle } from "../auth/throttle";
import { InputError } from "../errors";
import type { Issues } from "../issues";
import { Catalog } from "../catalog";
import { Diary } from "../diary";
import { storeEvents } from "../events";
import { DogRepository } from "../dogs";
import { logger } from "../log";
import { PeopleRepository } from "../people";
import { Sessions } from "../sessions";
import { Tracks } from "../tracks";
import type { DB } from "../db/open";
import { type Implementations, NotFound, router, TooMany } from "./router";

export type ApiDeps = {
  db: DB;
  now: () => Date;
  publicUrl: string;
  codeKey: string; // keys the link codes' hashes (secret.ts linkCodeKey)
  codeThrottle: Throttle; // wrong sign-in codes, kept across requests
  client: string; // who asks (throttle.ts clientOf)
  oidc: boolean;
  mailer: Mailer | null;
  timeZone?: string; // default Europe/Berlin
  defaultDogName?: string | null; // DOG_NAME
  issues?: Issues | null; // Wünsche und Fehler on GitHub, when configured
  reportThrottle?: Throttle; // reports from the app, per device, kept across requests
  clientEvents?: ClientEventWants; // what is kept of the app's events (CLIENT_EVENTS), default all
  eventThrottle?: Throttle; // the app's event batches, per device, kept across requests
};

const names = (deps: ApiDeps) => new PeopleRepository(deps.db).names();
const diary = async (deps: ApiDeps) => new Diary({ db: deps.db, names: await names(deps), timeZone: deps.timeZone ?? "Europe/Berlin", now: deps.now });
const sessions = async (deps: ApiDeps) => new Sessions({ db: deps.db, names: await names(deps), now: deps.now });
const dogs = (deps: ApiDeps) => new DogRepository(deps.db, deps.now);
const missing = (what: string) => {
  throw new NotFound(what);
};

const linkKey = (i: { token?: string; code?: string }): LinkKey => (i.code !== undefined ? { code: i.code } : { token: i.token! });
const links = (deps: ApiDeps) => new Links(deps.db, deps.now, deps.publicUrl, deps.codeKey, deps.defaultDogName ?? null);
const TOO_MANY = "Zu viele falsche Codes. Bitte in ein paar Minuten nochmal.";
const issues = (deps: ApiDeps) => deps.issues ?? missing("Wünsche und Fehler sind auf diesem Server nicht eingerichtet.");
// A code can be guessed, a link's token can't: wrong codes count, and too many of them wait before the next is looked up.
async function byCode<T>(deps: ApiDeps, key: LinkKey, look: (key: LinkKey) => Promise<T>): Promise<T> {
  if (!("code" in key)) return look(key);
  const now = deps.now().getTime();
  if (deps.codeThrottle.blocked(deps.client, now)) throw new TooMany(TOO_MANY);
  try {
    return await look(key);
  } catch (e) {
    if (e instanceof WrongLink) deps.codeThrottle.count(deps.client, now);
    throw e;
  }
}

const implementations: Implementations<ApiDeps> = {
  redeem: async ({ input, deps }) => byCode(deps, linkKey(input), (key) => links(deps).redeem(key, input)),
  linkInfo: async ({ input, deps }) => byCode(deps, linkKey(input), (key) => links(deps).info(key)),
  options: async ({ deps }) => ({ oidc: deps.oidc, mail: deps.mailer !== null }),
  magicLink: async ({ input, deps }) => {
    if (!deps.mailer) throw new InputError("E-Mail ist auf diesem Server nicht eingerichtet.");
    await sendMagicLink(deps.db, deps.now, deps.publicUrl, deps.codeKey, deps.mailer, input.email);
    return { sent: true as const };
  },
  createInvite: async ({ input, auth, deps }) => {
    // with an OIDC provider, the provider decides who is in: invites only add devices of existing members
    if (input.kind === "person" && deps.oidc) throw new InputError("Neue Personen kommen über die Anmeldung herein.");
    const link = await links(deps).create({ kind: input.kind, personId: input.kind === "person" ? null : auth.person.id, createdBy: auth.person.id, ttlMs: INVITE_TTL });
    return { id: link.id, url: link.url, appLink: appLink(deps.publicUrl, link.token), code: link.code, expiresAt: link.expiresAt };
  },
  invites: async ({ auth, deps }) => ({ invites: await links(deps).open(auth.person.id) }),
  revokeInvite: async ({ input, auth, deps }) => {
    if (!(await links(deps).revoke(auth.person.id, input.id))) throw new NotFound("Diese Einladung gibt es nicht.");
    return { revoked: true as const };
  },
  dogs: async ({ input, deps }) => ({ dogs: await dogs(deps).list({ withArchived: input.archived === "1" }) }),
  addDog: async ({ input, deps }) => dogs(deps).add(input),
  updateDog: async ({ input: { id, ...change }, deps }) => (await dogs(deps).update(id, change)) ?? missing("Diesen Hund gibt es nicht."),
  sessions: async ({ deps }) => (await sessions(deps)).current(),
  commands: async ({ input, auth, deps }) => {
    const s = await sessions(deps);
    return { ...(await s.apply(auth.person, input.commands, auth.device)), view: await s.current() };
  },
  entries: async ({ input, deps }) => {
    const d = await diary(deps);
    return d.history(d.filter(input), input.offset ?? 0);
  },
  entry: async ({ input, deps }) => (await (await diary(deps)).get(input.id)) ?? missing("Diesen Eintrag gibt es nicht."),
  logEntry: async ({ input, auth, deps }) => (await diary(deps)).log(auth.person, { at: deps.now().toISOString(), ...input }),
  editEntry: async ({ input: { id, ...fields }, deps }) => (await (await diary(deps)).edit(id, fields)) ?? missing("Diesen Eintrag gibt es nicht."),
  editTraining: async ({ input: { id, ...change }, deps }) => (await (await diary(deps)).editTraining(id, change)) ?? missing("Dieses Training gibt es nicht."),
  deleteEntry: async ({ input, deps }) => ((await (await diary(deps)).remove(input.id)) ? { deleted: true as const } : missing("Diesen Eintrag gibt es nicht.")),
  uploadTrack: async ({ input, auth, deps }) => new Tracks(deps.db, deps.now).addBatch(auth.device.id, input),
  walk: async ({ input, deps }) => {
    const entry = await deps.db.selectFrom("entry").select("type").where("id", "=", input.id).executeTakeFirst();
    if (entry?.type !== "walk") throw new NotFound("Diese Runde gibt es nicht.");
    const [summary, track] = await Promise.all([(await sessions(deps)).summary(input.id), new Tracks(deps.db, deps.now).forWalk(input.id)]);
    return { summary, track };
  },
  walkByKey: async ({ input, deps }) => {
    const summary = await (await sessions(deps)).summaryFor(input.key);
    if (!summary) throw new NotFound("Diese Runde gibt es nicht.");
    return { summary, track: await new Tracks(deps.db, deps.now).forWalk(summary.id) };
  },
  exercises: async ({ deps }) => ({ exercises: await new Catalog(deps.db).exercises() }),
  addExercise: async ({ input, deps }) => new Catalog(deps.db).addExercise(input.name),
  updateExercise: async ({ input, deps }) => {
    const c = new Catalog(deps.db);
    if (input.name !== undefined) await c.renameExercise(input.id, input.name);
    if (input.archived) await c.archiveExercise(input.id);
    return { updated: true as const };
  },
  treatKinds: async ({ deps }) => ({ treatKinds: await new Catalog(deps.db).treatKinds() }),
  addTreatKind: async ({ input, deps }) => new Catalog(deps.db).addTreatKind(input),
  updateTreatKind: async ({ input, deps }) => {
    const c = new Catalog(deps.db);
    if ("archived" in input) await c.archiveTreatKind(input.id);
    else await c.updateTreatKind(input.id, input);
    return { updated: true as const };
  },
  stock: async ({ deps }) => (await diary(deps)).stock(),
  restock: async ({ input, auth, deps }) => (await diary(deps)).restock(auth.person, input),
  correctStock: async ({ input, auth, deps }) => (await diary(deps)).correctStock(auth.person, input),
  lastFood: async ({ deps }) => (await diary(deps)).lastFoodAmounts(),
  weights: async ({ deps }) => ({ weights: await (await diary(deps)).all({ type: "weight" }) }),
  logWeight: async ({ input, auth, deps }) => (await diary(deps)).logWeight(auth.person, { at: deps.now().toISOString(), ...input }),
  today: async ({ deps }) => (await diary(deps)).today(),
  people: async ({ deps }) => ({ people: await new PeopleRepository(deps.db).list() }),
  week: async ({ input, deps }) => (await diary(deps)).week(input.w),
  updateMe: async ({ input, auth, deps }) => ({ person: await new PeopleRepository(deps.db, deps.now).update(auth.person.id, input) }),
  me: async ({ auth, deps }) => ({ person: auth.person, device: auth.device, household: { oidc: deps.oidc, mail: deps.mailer !== null, issues: !!deps.issues } }),
  devices: async ({ auth, deps }) => ({
    devices: (await new Devices(deps.db, deps.now).list(auth.person.id)).map((d) => ({ ...d, current: d.id === auth.device.id })),
  }),
  removeDevice: async ({ input, auth, deps }) => {
    if (!(await new Devices(deps.db, deps.now).remove(auth.person.id, input.id))) throw new NotFound("Dieses Gerät gibt es nicht.");
    return { removed: true as const };
  },
  issues: async ({ deps }) => ({ issues: await issues(deps).list(deps.now().getTime()) }),
  reportEvents: async ({ input, auth, deps }) => {
    const wants = deps.clientEvents ?? "all";
    const device = `device ${auth.device.id}`;
    const now = deps.now().getTime();
    if (deps.eventThrottle?.blocked(device, now)) throw new TooMany("Gerade viel gemeldet. Bitte später nochmal.");
    deps.eventThrottle?.count(device, now);
    const stored = await storeEvents(deps.db, auth.device.id, auth.person.id, input, deps.now().toISOString(), wants);
    // errors also as a log line each, for `docker compose logs gassi | grep client-error`
    const log = logger("client-error");
    const who = { person: auth.person.name, device: auth.device.name, kind: auth.device.kind, version: input.version, platform: input.platform };
    for (const e of stored) if (e.kind === "error") log.warn({ ...e.data, at: e.at, name: e.name, ...who }, "client error");
    return { received: stored.length, wants };
  },
  reportIssue: async ({ input, auth, deps }) => {
    const filed = issues(deps);
    const now = deps.now().getTime();
    const device = `device ${auth.device.id}`;
    if (deps.reportThrottle?.blocked(device, now)) throw new TooMany("Gerade viel gemeldet. Bitte später nochmal.");
    deps.reportThrottle?.count(device, now);
    return filed.report(input, auth.person.name, auth.device.name);
  },
};

export function apiRouter(deps: ApiDeps) {
  return router(implementations, deps, (authorization) => new Devices(deps.db, deps.now).authenticate(authorization));
}
