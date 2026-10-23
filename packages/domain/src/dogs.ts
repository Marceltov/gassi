// Which entries belong to which dogs: pee, marking, poop, weight and encounters to exactly one; walks, trainings and feedings to one or
// more; restocks, stock counts, opened cans and notes to none (they are the household's).
import type { EntryType } from "./entryTypes";

export type DogRule = "one" | "some" | "none";

const RULES: Record<EntryType, DogRule> = {
  pee: "one",
  mark: "one",
  poop: "one",
  weight: "one",
  dogEncounter: "one",
  personEncounter: "one",
  walk: "some",
  training: "some",
  food: "some",
  restock: "none",
  stockcheck: "none",
  opened: "none",
  note: "none",
};

export const dogRule = (type: EntryType): DogRule => RULES[type];

/** A German message when `dogIds` don't fit the entry type, else null. The same dog twice counts once. */
export function checkDogs(type: EntryType, dogIds: readonly number[]): string | null {
  const count = new Set(dogIds).size;
  const rule = RULES[type];
  if (rule === "none") return count === 0 ? null : "Das gehört zu keinem Hund.";
  if (count === 0) return "Für welchen Hund?";
  if (rule === "one" && count > 1) return "Das geht nur für einen Hund.";
  return null;
}
