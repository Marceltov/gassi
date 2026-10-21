// The API as one table: every endpoint with its method, path, whether it needs a device token, and the zod schemas
// of what goes in and what comes back. The client is built from it and the server's router validates against it, so
// the two can't drift apart. Path params (":id") are filled from the input; the rest of a GET or DELETE input goes
// into the query string, of a POST or PATCH into the JSON body.
import {
  commandSchema,
  ENTRY_MESSAGES,
  ENTRY_TYPES,
  entryCreateInput,
  entryEditInput,
  trainingEditInput,
  FOOD_KINDS,
  type FieldMessages,
  RESTOCK_MESSAGES,
  restockInput,
  STOCK_COUNT_MESSAGES,
  stockCountInput,
  WEIGHT_MESSAGES,
  weightInput,
} from "@gassi/domain";
import { z } from "zod";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type Endpoint<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType, A extends boolean = boolean> = {
  method: Method;
  path: string;
  auth: A;
  input: I;
  output: O;
  /** German messages per input field, for an input that doesn't fit (client and server answer with the same one). */
  messages?: FieldMessages;
};

export function endpoint<I extends z.ZodType, O extends z.ZodType, A extends boolean = true>(e: { method: Method; path: string; auth?: A; input: I; output: O; messages?: FieldMessages }): Endpoint<I, O, A> {
  return { ...e, auth: (e.auth ?? true) as A };
}

const none = z.object({});
const id = z.coerce.number().int().positive();

export const personSchema = z.object({ id: z.string(), name: z.string() });
export const deviceKinds = ["phone", "watch", "web", "script"] as const;
export const deviceSchema = z.object({ id: z.number(), kind: z.enum(deviceKinds), name: z.string() });

export const dogSchema = z.object({ id: z.number(), name: z.string(), color: z.string(), archived: z.boolean() });

const exerciseTotalSchema = z.object({ name: z.string(), ok: z.number(), fail: z.number() });
const repSchema = z.object({ exerciseId: z.number(), dogId: z.number(), ok: z.number(), fail: z.number() });
const routeSchema = z.array(z.tuple([z.number(), z.number()]));

export const entryViewSchema = z.object({
  id: z.number(),
  dogIds: z.array(z.number()),
  type: z.enum(ENTRY_TYPES),
  at: z.string(),
  endedAt: z.string().nullable(),
  durationMin: z.number().nullable(),
  amountG: z.number().nullable(),
  foodKind: z.enum(FOOD_KINDS).nullable(),
  unitG: z.number().nullable(),
  clientKey: z.string().nullable(),
  note: z.string().nullable(),
  loggedBy: z.string(),
  byName: z.string(),
  walkers: z.array(z.string()),
  walkerIds: z.array(z.string()),
  pauseMin: z.number().nullable(),
  exercises: z.array(exerciseTotalSchema),
  treats: z.number().nullable(),
  // a training's repetitions per exercise and dog and its treats per kind, as editTraining takes them (else empty)
  reps: z.array(repSchema),
  treatCounts: z.array(z.object({ treatKindId: z.number(), count: z.number() })),
  distanceM: z.number().nullable(),
  route: routeSchema.nullable(),
  // a walk's pee, poop and the trainings' exercises during it, decided by time (ADR 0002); null for other entries
  during: z.object({ pees: z.number(), poops: z.number(), exercises: z.array(exerciseTotalSchema) }).nullable(),
  // a wet count's can sizes (its rows at the same time, smallest can first), moved and deleted as one; null for others
  count: z.array(z.object({ unitG: z.number(), amountG: z.number() })).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const walkView = z.object({
  key: z.string(),
  startedAt: z.string(),
  dogIds: z.array(z.number()),
  walkers: z.array(personSchema),
  pauses: z.array(z.object({ startedAt: z.string(), endedAt: z.string().nullable() })),
  paused: z.boolean(),
});
const trainingView = z.object({
  key: z.string(),
  startedAt: z.string(),
  dogIds: z.array(z.number()),
  walkKey: z.string().nullable(),
  reps: z.array(repSchema),
  treats: z.record(z.string(), z.number()),
});
export const sessionsViewSchema = z.object({ walk: walkView.nullable(), training: trainingView.nullable() });

export const trackPointSchema = z.object({
  t: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  ele: z.number().min(-500).max(9000).nullable(),
  acc: z.number().min(0).max(10_000).nullable(),
});
const metricsSchema = z.object({
  distanceM: z.number(),
  durationS: z.number(),
  movingS: z.number(),
  paceSPerKm: z.number().nullable(),
  ascentM: z.number(),
  descentM: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});
const markSchema = z.object({ id: z.number(), at: z.string(), dogId: z.number() });
export const walkSummarySchema = z.object({
  id: z.number(),
  note: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  totalMin: z.number(),
  pauseMin: z.number(),
  pauseCount: z.number(),
  walkers: z.array(personSchema),
  trainings: z.array(z.object({ min: z.number(), exercises: z.array(exerciseTotalSchema), treats: z.array(z.object({ name: z.string(), count: z.number() })) })),
  // the walk's pee and poop entries (their ids, to open one), oldest first
  pees: z.array(markSchema),
  poops: z.array(markSchema),
});
const walkOutput = z.object({ summary: walkSummarySchema, track: z.object({ source: z.enum(["phone", "watch"]), points: z.array(trackPointSchema), metrics: metricsSchema }).nullable() });

const exerciseSchema = z.object({ id: z.number(), name: z.string() });
const treatKindSchema = z.object({ id: z.number(), name: z.string(), gramsPerPiece: z.number(), fromDry: z.boolean() });
const treatKindInput = z.object({ name: z.string(), gramsPerPiece: z.number(), fromDry: z.boolean() });
const kindStock = { grams: z.number().nullable(), daysLeft: z.number().nullable(), belowZero: z.boolean() };
const canStock = z.object({ unitG: z.number(), grams: z.number(), cans: z.number(), belowZero: z.boolean() });
const stockSchema = z.object({ wet: z.object({ ...kindStock, sizes: z.array(canStock), newestUnitG: z.number().nullable() }), dry: z.object(kindStock) });
const weekSchema = z.object({
  monday: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      bars: z.array(z.object({ type: z.enum(["walk", "training"]), startMin: z.number(), endMin: z.number() })),
      ticks: z.array(z.object({ type: z.enum(["food", "pee", "poop"]), min: z.number() })),
      walkMin: z.number(),
      trainingMin: z.number(),
    }),
  ),
  byPerson: z.array(
    z.object({ id: z.string(), name: z.string(), walks: z.number(), walkMin: z.number(), km: z.number(), feedings: z.number(), trainings: z.number(), trainingMin: z.number(), ok: z.number(), fail: z.number() }),
  ),
  exercises: z.array(exerciseTotalSchema),
  routes: z.array(z.object({ walkId: z.number(), route: routeSchema })),
  treats: z.number(),
});
const LINK_OR_CODE = "Link oder Code fehlt.";
export const linkKinds = ["setup", "person", "device", "watch", "magic"] as const;
// the link's token, or its code as typed into the app (XXXX-XXXX, loosely); exactly one of them
const linkKey = { token: z.string().min(1).max(100).optional(), code: z.string().min(1).max(20).optional() };
const oneKey = (i: { token?: string; code?: string }) => (i.token === undefined) !== (i.code === undefined);
const openLink = z.object({ id: z.number(), kind: z.enum(linkKinds), createdAt: z.string(), expiresAt: z.string() });

export const contract = {
  redeem: endpoint({
    method: "POST",
    path: "/api/auth/redeem",
    auth: false,
    input: z
      .object({
        ...linkKey,
        deviceKind: z.enum(deviceKinds),
        deviceName: z.string().trim().min(1).max(60),
        personName: z.string().optional(),
        dogName: z.string().optional(),
      })
      .refine(oneKey, { message: LINK_OR_CODE, path: ["token"] }),
    output: z.object({ deviceToken: z.string(), person: personSchema, device: deviceSchema }),
    messages: { token: LINK_OR_CODE, code: LINK_OR_CODE },
  }),
  // what an open link is for (so the sign-in asks for a name, and a dog for setup), without using it; a used, expired
  // or unknown one answers like redeem
  linkInfo: endpoint({
    method: "GET",
    path: "/api/auth/link",
    auth: false,
    input: z.object(linkKey).refine(oneKey, { message: LINK_OR_CODE, path: ["token"] }),
    output: z.object({ kind: z.enum(linkKinds) }),
    messages: { token: LINK_OR_CODE, code: LINK_OR_CODE },
  }),
  // what the sign-in can offer before there is a token: the household's OIDC provider, a link by e-mail
  options: endpoint({ method: "GET", path: "/api/auth/options", auth: false, input: none, output: z.object({ oidc: z.boolean(), mail: z.boolean() }) }),
  magicLink: endpoint({
    method: "POST",
    path: "/api/auth/magic",
    auth: false,
    input: z.object({ email: z.string().trim().min(3).max(200) }),
    output: z.object({ sent: z.literal(true) }),
  }),
  createInvite: endpoint({
    method: "POST",
    path: "/api/invites",
    input: z.object({ kind: z.enum(["person", "device", "watch"]) }),
    // the code is shown only now: the server keeps just its hash
    output: z.object({ id: z.number(), url: z.string(), appLink: z.string(), code: z.string(), expiresAt: z.string() }),
  }),
  invites: endpoint({ method: "GET", path: "/api/invites", input: none, output: z.object({ invites: z.array(openLink) }) }),
  revokeInvite: endpoint({ method: "DELETE", path: "/api/invites/:id", input: z.object({ id }), output: z.object({ revoked: z.literal(true) }) }),
  dogs: endpoint({ method: "GET", path: "/api/dogs", input: z.object({ archived: z.enum(["0", "1"]).optional() }), output: z.object({ dogs: z.array(dogSchema) }) }),
  addDog: endpoint({ method: "POST", path: "/api/dogs", input: z.object({ name: z.string(), color: z.string() }), output: dogSchema }),
  updateDog: endpoint({
    method: "PATCH",
    path: "/api/dogs/:id",
    input: z.object({ id, name: z.string().optional(), color: z.string().optional(), archived: z.boolean().optional() }),
    output: dogSchema,
  }),
  sessions: endpoint({ method: "GET", path: "/api/sessions", input: none, output: sessionsViewSchema }),
  commands: endpoint({
    method: "POST",
    path: "/api/commands",
    input: z.object({ commands: z.array(commandSchema).max(100) }),
    output: z.object({ applied: z.array(z.string()), dropped: z.array(z.string()), view: sessionsViewSchema }),
  }),
  entries: endpoint({
    method: "GET",
    path: "/api/entries",
    input: z.object({ type: z.string().optional(), by: z.string().optional(), day: z.string().optional(), dog: z.string().optional(), offset: z.coerce.number().int().min(0).optional() }),
    output: z.object({ entries: z.array(entryViewSchema), more: z.boolean() }),
  }),
  entry: endpoint({ method: "GET", path: "/api/entries/:id", input: z.object({ id }), output: entryViewSchema }),
  logEntry: endpoint({ method: "POST", path: "/api/entries", input: entryCreateInput, output: entryViewSchema, messages: ENTRY_MESSAGES }),
  // all fields are sent (a left-out note or amount becomes null), except walkers: left out, they stay as they are
  editEntry: endpoint({ method: "PATCH", path: "/api/entries/:id", input: entryEditInput, output: entryViewSchema, messages: ENTRY_MESSAGES }),
  editTraining: endpoint({ method: "PATCH", path: "/api/trainings/:id", input: trainingEditInput, output: entryViewSchema, messages: ENTRY_MESSAGES }),
  deleteEntry: endpoint({ method: "DELETE", path: "/api/entries/:id", input: z.object({ id }), output: z.object({ deleted: z.literal(true) }) }),
  uploadTrack: endpoint({
    method: "POST",
    path: "/api/tracks",
    input: z.object({ trackId: z.string().min(1).max(64), walkKey: z.string().min(1).max(64), source: z.enum(["phone", "watch"]), seq: z.number().int().min(0), points: z.array(trackPointSchema).min(1).max(2000) }),
    output: z.object({ stored: z.boolean() }),
  }),
  walk: endpoint({ method: "GET", path: "/api/walks/:id", input: z.object({ id }), output: walkOutput }),
  // the same for the walk a phone started (or joined) with `key`, before it knows the walk's id; 404 while the server
  // doesn't know the key yet
  walkByKey: endpoint({ method: "GET", path: "/api/walks/key/:key", input: z.object({ key: z.string().min(1).max(64) }), output: walkOutput }),
  exercises: endpoint({ method: "GET", path: "/api/exercises", input: none, output: z.object({ exercises: z.array(exerciseSchema) }) }),
  addExercise: endpoint({ method: "POST", path: "/api/exercises", input: z.object({ name: z.string() }), output: exerciseSchema }),
  updateExercise: endpoint({ method: "PATCH", path: "/api/exercises/:id", input: z.object({ id, name: z.string().optional(), archived: z.literal(true).optional() }), output: z.object({ updated: z.literal(true) }) }),
  treatKinds: endpoint({ method: "GET", path: "/api/treat-kinds", input: none, output: z.object({ treatKinds: z.array(treatKindSchema) }) }),
  addTreatKind: endpoint({ method: "POST", path: "/api/treat-kinds", input: treatKindInput, output: treatKindSchema }),
  updateTreatKind: endpoint({
    method: "PATCH",
    path: "/api/treat-kinds/:id",
    input: z.union([treatKindInput.extend({ id }), z.object({ id, archived: z.literal(true) })]),
    output: z.object({ updated: z.literal(true) }),
  }),
  stock: endpoint({ method: "GET", path: "/api/stock", input: none, output: stockSchema }),
  restock: endpoint({ method: "POST", path: "/api/stock/restock", input: restockInput, output: entryViewSchema, messages: RESTOCK_MESSAGES }),
  // a wet count is one entry per can size
  correctStock: endpoint({ method: "POST", path: "/api/stock/correct", input: stockCountInput, output: z.object({ entries: z.array(entryViewSchema) }), messages: STOCK_COUNT_MESSAGES }),
  // each kind's last portion, and the can size the last wet feeding came out of
  lastFood: endpoint({ method: "GET", path: "/api/food/last", input: none, output: z.object({ wet: z.number().nullable(), dry: z.number().nullable(), wetUnitG: z.number().nullable() }) }),
  weights: endpoint({ method: "GET", path: "/api/weight", input: none, output: z.object({ weights: z.array(entryViewSchema) }) }),
  logWeight: endpoint({ method: "POST", path: "/api/weight", input: weightInput, output: entryViewSchema, messages: WEIGHT_MESSAGES }),
  today: endpoint({ method: "GET", path: "/api/today", input: none, output: z.object({ walk: entryViewSchema.nullable(), food: entryViewSchema.nullable(), pee: entryViewSchema.nullable(), poop: entryViewSchema.nullable() }) }),
  people: endpoint({ method: "GET", path: "/api/people", input: none, output: z.object({ people: z.array(personSchema) }) }),
  week: endpoint({ method: "GET", path: "/api/week", input: z.object({ w: z.string().optional() }), output: weekSchema }),
  updateMe: endpoint({
    method: "PATCH",
    path: "/api/me",
    input: z.object({ name: z.string().trim().min(1).max(40).optional(), email: z.email().nullable().optional() }),
    output: z.object({ person: personSchema.extend({ email: z.string().nullable() }) }),
  }),
  me: endpoint({
    method: "GET",
    path: "/api/me",
    input: none,
    output: z.object({ person: personSchema, device: deviceSchema, household: z.object({ oidc: z.boolean(), mail: z.boolean() }) }),
  }),
  devices: endpoint({
    method: "GET",
    path: "/api/devices",
    input: none,
    output: z.object({ devices: z.array(deviceSchema.extend({ createdAt: z.string(), lastSeenAt: z.string().nullable(), current: z.boolean() })) }),
  }),
  removeDevice: endpoint({ method: "DELETE", path: "/api/devices/:id", input: z.object({ id }), output: z.object({ removed: z.literal(true) }) }),
};

export type Contract = typeof contract;
export type EndpointName = keyof Contract;
/** What a caller passes (before parsing) and what the server's handler gets (after parsing). */
export type Input<K extends EndpointName> = z.input<Contract[K]["input"]>;
export type ParsedInput<K extends EndpointName> = z.output<Contract[K]["input"]>;
export type Output<K extends EndpointName> = z.output<Contract[K]["output"]>;

/** "/api/devices/:id" with { id: 7, x: 1 } → "/api/devices/7" and the rest { x: 1 }. */
export function fillPath(pattern: string, input: Record<string, unknown>): { path: string; rest: Record<string, unknown> } {
  const rest = { ...input };
  const path = pattern.replace(/:(\w+)/g, (_, name: string) => {
    const value = rest[name];
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  return { path, rest };
}

/** The path params when `pathname` fits `pattern`, else null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const names: string[] = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, name: string) => (names.push(name), "([^/]+)"))}$`);
  const m = re.exec(pathname);
  return m ? Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) : null;
}

export const sendsBody = (method: Method) => method === "POST" || method === "PATCH";
