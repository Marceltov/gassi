// What people enter besides entries (restocks, stock counts, weight), as zod schemas with a German message per
// field, and how a failed check becomes that message. The server, the client and the use cases share them, so an
// input is checked one way everywhere and says what is wrong in the same words.
import { z } from "zod";

/** Field name → message; "" is the fallback. */
export type FieldMessages = Record<string, string>;

const FALLBACK = "Die Eingabe stimmt nicht.";

/** The message for the first problem of a failed check: its field's, else the fallback. */
export function messageFor(messages: FieldMessages, error: z.ZodError): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  return messages[field] ?? messages[""] ?? FALLBACK;
}

const decimal = (v: unknown) => (typeof v === "string" ? (v.trim() ? Number(v.trim().replace(",", ".")) : NaN) : v);
const instant = z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString());

/** Bought food: wet as cans × grams per can, dry in grams. */
export const restockInput = z.discriminatedUnion("foodKind", [
  z.object({ foodKind: z.literal("wet"), cans: z.coerce.number().int().min(1).max(1000), unitG: z.coerce.number().int().min(1).max(10_000) }),
  z.object({ foodKind: z.literal("dry"), grams: z.coerce.number().int().min(1).max(1_000_000) }),
]);
export const RESTOCK_MESSAGES: FieldMessages = {
  foodKind: "Diese Futterart gibt es nicht.",
  cans: "Wie viele Dosen, und wie viel Gramm hat eine Dose?",
  unitG: "Wie viele Dosen, und wie viel Gramm hat eine Dose?",
  grams: "Wie viel Gramm hast du gekauft?",
};

/** What is there now, counted by hand: wet in cans (of the last can size bought), dry in grams. */
export const stockCountInput = z.discriminatedUnion("foodKind", [
  z.object({ foodKind: z.literal("wet"), cans: z.coerce.number().min(0).max(1000) }),
  z.object({ foodKind: z.literal("dry"), grams: z.coerce.number().int().min(0).max(1_000_000) }),
]);
export const STOCK_COUNT_MESSAGES: FieldMessages = {
  foodKind: "Diese Futterart gibt es nicht.",
  cans: "Wie viele Dosen sind noch da?",
  grams: "Wie viel Gramm sind noch da?",
};

/** A dog's weight in kg ("12,4" or 12.4), when (default now) and for which dog. */
export const weightInput = z.object({
  kg: z.preprocess(decimal, z.number().min(0.5).max(100)),
  at: instant.optional(),
  dogIds: z.array(z.number().int().positive()).optional(),
});
export const WEIGHT_MESSAGES: FieldMessages = {
  kg: "Das Gewicht muss zwischen 0,5 und 100 kg liegen.",
  at: "Die Zeit fehlt oder stimmt nicht.",
  dogIds: "Diesen Hund gibt es nicht.",
};
