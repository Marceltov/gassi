// The kinds of entries and their German words. A new kind is a new value here, not a new table.
export const ENTRY_TYPES = ["walk", "food", "pee", "poop", "note", "training", "weight", "restock", "stockcheck"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** The kinds that get a tile on the today screen, in tile order. */
export const TILE_TYPES = ["walk", "food", "pee", "poop"] as const satisfies readonly EntryType[];

export const TYPE_LABEL: Record<EntryType, string> = {
  walk: "Gassi",
  food: "Futter",
  pee: "Pipi",
  poop: "Poopoo",
  note: "Notiz",
  training: "Training",
  weight: "Gewicht",
  restock: "Einkauf",
  stockcheck: "Bestand",
};

export const isEntryType = (v: unknown): v is EntryType => (ENTRY_TYPES as readonly unknown[]).includes(v);

/** Wet food comes in cans, dry food by weight; food, restock and stockcheck entries say which. */
export const FOOD_KINDS = ["wet", "dry"] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

export const FOOD_LABEL: Record<FoodKind, string> = { wet: "Nassfutter", dry: "Trockenfutter" };

export const isFoodKind = (v: unknown): v is FoodKind => (FOOD_KINDS as readonly unknown[]).includes(v);

/** Whole minutes from `at` to `endedAt`, or null without an end. */
export function minutesBetween(at: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  return Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(at)) / 60_000));
}
