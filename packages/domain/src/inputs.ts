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

/** Grams per can: a whole number from 1 to 10000. */
const canSize = z.coerce.number().int().min(1).max(10_000);

/** The units dry food is entered in. */
export const DRY_UNITS = ["g", "kg"] as const;
export type DryUnit = (typeof DRY_UNITS)[number];

/** Dry food as typed: an amount ("1,5" or 1.5) in g or kg (g when left out), checked and kept as whole grams from
 * `min` to 1000 kg. What it gives back ({ grams }) passes it again: the client sends its checked input on. */
const dryAmount = (min: number) =>
  z
    .object({
      foodKind: z.literal("dry"),
      amount: z.preprocess(decimal, z.number().min(0).max(1_000_000)).optional(),
      unit: z.enum(DRY_UNITS).default("g"),
      grams: z.number().optional(),
    })
    .transform((r) => ({ foodKind: r.foodKind, grams: r.amount === undefined ? r.grams : Math.round(r.unit === "kg" ? r.amount * 1000 : r.amount) }))
    .pipe(z.object({ foodKind: z.literal("dry"), grams: z.number().int().min(min).max(1_000_000) }));

/** No can size twice. */
const onceEach = (sizes: readonly { unitG: number }[]) => new Set(sizes.map((s) => s.unitG)).size === sizes.length;

/** Bought food: wet as whole cans per can size (one restock each; sizes bought none of are left out), dry in g or kg. */
export const restockInput = z.discriminatedUnion("foodKind", [
  z
    .object({ foodKind: z.literal("wet"), sizes: z.array(z.object({ unitG: canSize, cans: z.coerce.number().int().min(0).max(1000) })).min(1).max(20) })
    .refine((r) => onceEach(r.sizes), { path: ["unitG"], message: "twice" })
    .transform((r) => ({ ...r, sizes: r.sizes.filter((s) => s.cans > 0) }))
    .refine((r) => r.sizes.length > 0, { path: ["sizes"], message: "none" }),
  dryAmount(1),
]);
export const RESTOCK_MESSAGES: FieldMessages = {
  foodKind: "Diese Futterart gibt es nicht.",
  sizes: "Wie viele Dosen welcher Größe hast du gekauft?",
  unitG: "Jede Dosengröße nur einmal.",
  amount: "Wie viel hast du gekauft?",
  grams: "Wie viel hast du gekauft?",
  unit: "Gramm oder Kilogramm?",
};

/** What is there now, counted by hand: wet in cans per can size ("2,5" or 2.5 for an opened can; every size at once,
 * a size left out is 0), dry in g or kg. */
export const stockCountInput = z.discriminatedUnion("foodKind", [
  z
    .object({ foodKind: z.literal("wet"), sizes: z.array(z.object({ unitG: canSize, cans: z.preprocess(decimal, z.number().min(0).max(1000)) })).min(1).max(20) })
    .refine((r) => onceEach(r.sizes), { path: ["unitG"], message: "twice" }),
  dryAmount(0),
]);
export const STOCK_COUNT_MESSAGES: FieldMessages = {
  foodKind: "Diese Futterart gibt es nicht.",
  sizes: "Wie viele Dosen jeder Größe sind noch da?",
  unitG: "Jede Dosengröße nur einmal.",
  amount: "Wie viel ist noch da?",
  grams: "Wie viel ist noch da?",
  unit: "Gramm oder Kilogramm?",
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
