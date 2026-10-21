// The sign of each entry type, in Verlauf, its filter and an entry's detail.
import type { EntryType } from "@gassi/domain";

export const TYPE_ICON: Record<EntryType, string> = {
  walk: "🐕",
  food: "🥣",
  training: "🎯",
  pee: "💧",
  poop: "💩",
  weight: "⚖️",
  note: "📝",
  restock: "🛒",
  stockcheck: "📦",
};
