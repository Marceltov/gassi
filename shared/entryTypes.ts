// The kinds of entries and their German words. A new kind is a new value here, not a new table.
export const ENTRY_TYPES = ["walk", "food", "pee", "poop", "note"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** The kinds that get a tile on the today screen, in tile order. */
export const TILE_TYPES = ["walk", "food", "pee", "poop"] as const satisfies readonly EntryType[];

export const TYPE_LABEL: Record<EntryType, string> = { walk: "Gassi", food: "Futter", pee: "Pipi", poop: "Kacka", note: "Notiz" };

export const isEntryType = (v: unknown): v is EntryType => (ENTRY_TYPES as readonly unknown[]).includes(v);
