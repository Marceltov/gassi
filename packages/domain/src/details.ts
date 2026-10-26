// The details only some kinds of entries have (ADR 0013), each described once: its question, how it is answered (one
// choice, several, a scale or a text), its choices with their German words, whether the entry needs it, and how it
// reads in a list. Which kind has which details, in the order the form asks them, is KIND_DETAILS. The schema
// (entryDetails), the check (checkDetails), the list line (detailLine) and the app's form are all made from these.
import { z } from "zod";
import { CONSISTENCIES, CONSISTENCY_LABEL, type EntryType } from "./entryTypes";

type Option = { value: string; label: string; sub?: string };
/** One choice, as a row of segments (few, short) or as chips (more, longer). */
type Choice = { input: "choice"; look: "segments" | "chips"; options: Option[] };
/** Several choices at once, as chips. */
type Choices = { input: "choices"; options: Option[] };
/** A number on a scale, as a row of segments; `subs`: a word under each step. */
type Scale = { input: "scale"; min: number; max: number; subs?: readonly string[] };
type Text = { input: "text"; max: number; placeholder: string };
type Input = Choice | Choices | Scale | Text;
/** `needed`: the entry can't be without it. `line`: how its value reads in a list ("7/10"), else its words. */
export type DetailSpec = Input & { label: string; needed?: boolean; line?: (words: string) => string };

const optionsOf = <V extends string>(values: readonly V[], labels: Record<V, string>): Option[] => values.map((value) => ({ value, label: labels[value] }));
const choice = <const V extends readonly [string, ...string[]]>(values: V, labels: Record<V[number], string>, look: Choice["look"]) => ({
  input: "choice" as const,
  look,
  options: optionsOf(values, labels),
  schema: z.enum(values),
});
const choices = <const V extends readonly [string, ...string[]]>(values: V, labels: Record<V[number], string>) => ({
  input: "choices" as const,
  options: optionsOf(values, labels),
  schema: z.array(z.enum(values)).max(values.length),
});
const scale = (min: number, max: number, subs?: readonly string[]) => ({ input: "scale" as const, min, max, subs, schema: z.number().int().min(min).max(max) });
const text = (max: number, placeholder: string) => ({ input: "text" as const, max, placeholder, schema: z.string().trim().min(1).max(max) });

const REACTIONS = ["ruhig", "schaut", "fiept", "bellt", "explodiert"] as const;

export const DETAILS = {
  // a poop's (#86)
  consistency: { label: "Konsistenz", ...choice(CONSISTENCIES, CONSISTENCY_LABEL, "chips") },
  // a dog encounter's (#37)
  reaction: { label: "Wie stark hat er reagiert?", needed: true, ...scale(0, REACTIONS.length - 1, REACTIONS) },
  attention: { label: "Ansprechbar", line: (w: string) => `ansprechbar: ${w}`, ...choice(["good", "partial", "none"], { good: "gut", partial: "teilweise", none: "nicht" }, "segments") },
  handling: {
    label: "Wie seid ihr vorbei?",
    ...choice(["horizon", "avoided", "wideBerth", "turned", "passed", "through", "lifted"], { horizon: "am Horizont", avoided: "vermieden", wideBerth: "großer Bogen", turned: "umgedreht", passed: "ausgewichen", through: "mussten durch", lifted: "hochgehoben" }, "chips"),
  },
  distance: { label: "Abstand", ...choice(["near", "medium", "far"], { near: "nah", medium: "mittel", far: "weit" }, "segments") },
  // a person encounter's (#90)
  who: { label: "Wer?", needed: true, ...text(60, "z. B. Oma Inge") },
  place: { label: "Wo?", ...choice(["home", "outside", "theirs"], { home: "bei uns", outside: "draußen", theirs: "bei ihnen" }, "segments") },
  rating: { label: "Wie lief's? (1 schlecht – 10 super)", needed: true, line: (w: string) => `${w}/10`, ...scale(1, 10) },
  moods: { label: "Stimmung", ...choices(["friendly", "curious", "excited", "unsure", "afraid", "aggressive"], { friendly: "freundlich", curious: "neugierig", excited: "aufgeregt", unsure: "unsicher", afraid: "ängstlich", aggressive: "aggressiv" }) },
  insecurity: { label: "Wie unsicher? (1 gar nicht – 10 sehr)", line: (w: string) => `unsicher ${w}/10`, ...scale(1, 10) },
  // either encounter's: what he said
  sounds: { label: "Laute", ...choices(["growls", "whines", "howls", "screeches"], { growls: "knurrt", whines: "fiept", howls: "jault", screeches: "kreischt" }) },
} satisfies Record<string, DetailSpec & { schema: z.ZodType }>;

export type Detail = keyof typeof DETAILS;

/** Which kind has which details, in the order its form asks them and its line says them; both encounters ask Laute
 * right after their main scale (#95). */
export const KIND_DETAILS: Partial<Record<EntryType, readonly Detail[]>> = {
  poop: ["consistency"],
  dogEncounter: ["reaction", "sounds", "attention", "handling", "distance"],
  personEncounter: ["who", "place", "rating", "sounds", "moods", "insecurity"],
};

/** All details, each optional; what a kind needs is checked by checkDetails. Kept as one JSON column (ADR 0013). */
export const entryDetails = z.object(Object.fromEntries(Object.entries(DETAILS).map(([k, d]) => [k, d.schema.optional()])) as { [K in Detail]: z.ZodOptional<(typeof DETAILS)[K]["schema"]> }).strict();
export type EntryDetails = z.output<typeof entryDetails>;

/** A German message when `details` has one `type` can't have, or lacks one it needs (its question); else null. */
export function checkDetails(type: EntryType, details: EntryDetails | null): string | null {
  const mine = KIND_DETAILS[type] ?? [];
  if (Object.keys(details ?? {}).some((k) => !mine.includes(k as Detail))) return "Das passt nicht zu dieser Art von Eintrag.";
  const missing = mine.find((k) => (DETAILS[k] as DetailSpec).needed && details?.[k] === undefined);
  return missing ? DETAILS[missing].label : null;
}

/** The words of a detail's value: "großer Bogen", "knurrt · fiept", "2 fiept", "Oma Inge". */
export function detailWords(key: Detail, value: unknown): string {
  const spec: DetailSpec = DETAILS[key];
  const label = (v: unknown) => (spec.input === "choice" || spec.input === "choices" ? (spec.options.find((o) => o.value === v)?.label ?? String(v)) : String(v));
  if (spec.input === "choices") return (value as unknown[]).map(label).join(" · ");
  if (spec.input === "scale") return spec.subs ? `${value} ${spec.subs[(value as number) - spec.min]}` : String(value);
  return label(value);
}

/** What an entry's details say, in its kind's order: "2 fiept · großer Bogen · nah", "Oma Inge · bei uns · 7/10". */
export function detailLine(type: EntryType, details: EntryDetails | null): string {
  return (KIND_DETAILS[type] ?? [])
    .flatMap((k) => {
      const value = details?.[k];
      if (value === undefined || (Array.isArray(value) && value.length === 0)) return [];
      const spec: DetailSpec = DETAILS[k];
      const words = detailWords(k, value);
      return [spec.line ? spec.line(words) : words];
    })
    .join(" · ");
}
