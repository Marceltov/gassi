// What the walk and training screens send: one command per tap, with a client-made id (so a resend is harmless) and
// the time of the tap (so taps queued without reception keep their real time). Runs in the browser too.
import { z } from "zod";

const key = z.string().min(1).max(64);
const dogId = z.number().int().positive();
// The dogs a walk or training is for; left out, the server takes every active dog.
const dogIds = z.array(dogId).min(1).max(20).optional();
const base = { id: z.string().min(1).max(64), at: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()) };

export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("walk.start"), walkKey: key, dogIds }),
  z.object({ ...base, kind: z.literal("walk.join"), walkKey: key }),
  // another member of the household joins or leaves the walk / a dog joins or leaves it (any walker's phone may send these)
  z.object({ ...base, kind: z.literal("walk.walker"), walkKey: key, personId: z.string().min(1).max(64), on: z.boolean() }),
  z.object({ ...base, kind: z.literal("walk.dog"), walkKey: key, dogId, on: z.boolean() }),
  z.object({ ...base, kind: z.literal("walk.pause"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.resume"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.stop"), walkKey: key }),
  z.object({ ...base, kind: z.literal("training.start"), trainingKey: key, walkKey: key.optional(), dogIds }),
  z.object({ ...base, kind: z.literal("training.stop"), trainingKey: key }),
  z.object({ ...base, kind: z.literal("training.rep"), trainingKey: key, exerciseId: z.number().int().positive(), dogId, ok: z.boolean(), delta: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ ...base, kind: z.literal("training.treat"), trainingKey: key, treatKindId: z.number().int().positive(), delta: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ ...base, kind: z.literal("log"), type: z.enum(["pee", "poop"]), dogId }),
  // a feeding; the dogs left out, the server takes every active dog
  z.object({ ...base, kind: z.literal("food"), dogIds, amountG: z.number().int().min(1).max(5000), foodKind: z.enum(["wet", "dry"]) }),
]);

export type Command = z.output<typeof commandSchema>;
export type CommandKind = Command["kind"];

/** A new id for a command or a walk/training key: a v4 UUID. Browsers offer randomUUID only on https (and localhost),
 * not over plain http on a home network's address, so it is made from random bytes there. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
