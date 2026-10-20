// What the walk and training screens send: one command per tap, with a client-made id (so a resend is harmless) and
// the time of the tap (so taps queued without reception keep their real time). Runs in the browser too.
import { z } from "zod";

const key = z.string().min(1).max(64);
const base = { id: z.string().min(1).max(64), at: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()) };

export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("walk.start"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.join"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.pause"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.resume"), walkKey: key }),
  z.object({ ...base, kind: z.literal("walk.stop"), walkKey: key }),
  z.object({ ...base, kind: z.literal("training.start"), trainingKey: key, walkKey: key.optional() }),
  z.object({ ...base, kind: z.literal("training.stop"), trainingKey: key }),
  z.object({ ...base, kind: z.literal("training.exercise"), trainingKey: key, exerciseId: z.number().int().positive(), on: z.boolean() }),
  z.object({ ...base, kind: z.literal("training.treat"), trainingKey: key, treatKindId: z.number().int().positive(), delta: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ ...base, kind: z.literal("log"), type: z.enum(["pee", "poop"]) }),
]);

export type Command = z.output<typeof commandSchema>;
export type CommandKind = Command["kind"];

/** A new id for a command or a walk/training key. */
export const newId = (): string => crypto.randomUUID();
