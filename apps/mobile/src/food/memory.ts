// What the food sheet last learned from the server (the recent portions, each kind's last grams, the stock), so it
// opens with them without reception; kept per person with the rest (data/kept.ts), forgotten at sign-out.
import type { Output } from "@gassi/api-client";
import type { Portion } from "@gassi/domain";
import { loadKept, saveKept } from "../data/kept";

export type FoodFacts = { recent: Portion[]; last: Output<"lastFood"> | null; stock: Output<"stock"> | null };

/** How many of the newest feedings the portions are taken from. */
export const RECENT = 20;

const key = (personId: string) => `food.${personId}`;

export function loadFacts(personId: string): FoodFacts {
  const s = loadKept(key(personId)) as FoodFacts | null;
  if (!s || !Array.isArray(s.recent)) return { recent: [], last: null, stock: null };
  // a stock kept by an older version (without can sizes) is left for the server's next answer
  return Array.isArray(s.stock?.wet.sizes) ? s : { ...s, stock: null };
}

export const saveFacts = (personId: string, facts: FoodFacts): void => saveKept(key(personId), facts);

/** The facts after a feeding entered here (maybe still unsent): it is the newest portion and its kind's last. */
export function withFeeding(facts: FoodFacts, p: Portion): FoodFacts {
  const prev = facts.last;
  const last = { wet: prev?.wet ?? null, dry: prev?.dry ?? null, [p.foodKind]: p.amountG };
  return { ...facts, recent: [p, ...facts.recent].slice(0, RECENT), last };
}
