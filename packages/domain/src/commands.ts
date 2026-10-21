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

/** A new id for a command or a walk/training key. */
export const newId = (): string => crypto.randomUUID();
