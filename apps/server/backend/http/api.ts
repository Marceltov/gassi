// The implementations of the API contract, each a thin call into a use case.
import { Devices } from "../auth/devices";
import { appLink, INVITE_TTL, Links } from "../auth/links";
import { type Mailer, sendMagicLink } from "../auth/mail";
import { InputError } from "../errors";
import { Catalog } from "../catalog";
import { Diary } from "../diary";
import { DogRepository } from "../dogs";
import { PeopleRepository } from "../people";
import { Sessions } from "../sessions";
import { Tracks } from "../tracks";
import type { DB } from "../db/open";
import { type Implementations, NotFound, router } from "./router";

export type ApiDeps = { db: DB; now: () => Date; publicUrl: string; oidc: boolean; mailer: Mailer | null; timeZone?: string /* default Europe/Berlin */ };

const names = (deps: ApiDeps) => new PeopleRepository(deps.db).names();
const diary = async (deps: ApiDeps) => new Diary({ db: deps.db, names: await names(deps), timeZone: deps.timeZone ?? "Europe/Berlin", now: deps.now });
const sessions = async (deps: ApiDeps) => new Sessions({ db: deps.db, names: await names(deps), now: deps.now });
const dogs = (deps: ApiDeps) => new DogRepository(deps.db, deps.now);
const missing = (what: string) => {
  throw new NotFound(what);
};

const links = (deps: ApiDeps) => new Links(deps.db, deps.now, deps.publicUrl);

const implementations: Implementations<ApiDeps> = {
  redeem: async ({ input, deps }) => links(deps).redeem(input.token, input),
  magicLink: async ({ input, deps }) => {
    if (!deps.mailer) throw new InputError("E-Mail ist auf diesem Server nicht eingerichtet.");
    await sendMagicLink(deps.db, deps.now, deps.publicUrl, deps.mailer, input.email);
    return { sent: true as const };
  },
  createInvite: async ({ input, auth, deps }) => {
    // with an OIDC provider, the provider decides who is in: invites only add devices of existing members
    if (input.kind === "person" && deps.oidc) throw new InputError("Neue Personen kommen über die Anmeldung herein.");
    const link = await links(deps).create({ kind: input.kind, personId: input.kind === "person" ? null : auth.person.id, createdBy: auth.person.id, ttlMs: INVITE_TTL });
    return { id: link.id, url: link.url, appLink: appLink(deps.publicUrl, link.token), expiresAt: link.expiresAt };
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
    return { ...(await s.apply(auth.person, input.commands)), view: await s.current() };
  },
  entries: async ({ input, deps }) => {
    const d = await diary(deps);
    return d.history(d.filter(input), input.offset ?? 0);
  },
  logEntry: async ({ input, auth, deps }) => (await diary(deps)).log(auth.person, { at: deps.now().toISOString(), ...input }),
  editEntry: async ({ input: { id, ...fields }, deps }) => (await (await diary(deps)).edit(id, fields)) ?? missing("Diesen Eintrag gibt es nicht."),
  deleteEntry: async ({ input, deps }) => ((await (await diary(deps)).remove(input.id)) ? { deleted: true as const } : missing("Diesen Eintrag gibt es nicht.")),
  uploadTrack: async ({ input, auth, deps }) => new Tracks(deps.db, deps.now).addBatch(auth.device.id, input),
  walk: async ({ input, deps }) => {
    const entry = await deps.db.selectFrom("entry").select("type").where("id", "=", input.id).executeTakeFirst();
    if (entry?.type !== "walk") throw new NotFound("Diese Runde gibt es nicht.");
    const [summary, track] = await Promise.all([(await sessions(deps)).summary(input.id), new Tracks(deps.db, deps.now).forWalk(input.id)]);
    return { summary, track };
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
  week: async ({ input, deps }) => (await diary(deps)).week(input.w),
  updateMe: async ({ input, auth, deps }) => ({ person: await new PeopleRepository(deps.db, deps.now).update(auth.person.id, input) }),
  me: async ({ auth, deps }) => ({ person: auth.person, device: auth.device, household: { oidc: deps.oidc, mail: deps.mailer !== null } }),
  devices: async ({ auth, deps }) => ({
    devices: (await new Devices(deps.db, deps.now).list(auth.person.id)).map((d) => ({ ...d, current: d.id === auth.device.id })),
  }),
  removeDevice: async ({ input, auth, deps }) => {
    if (!(await new Devices(deps.db, deps.now).remove(auth.person.id, input.id))) throw new NotFound("Dieses Gerät gibt es nicht.");
    return { removed: true as const };
  },
};

export function apiRouter(deps: ApiDeps) {
  return router(implementations, deps, (authorization) => new Devices(deps.db, deps.now).authenticate(authorization));
}
