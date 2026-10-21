// The icon of each entry type, in Verlauf, its filter and an entry's detail.
import type { EntryType } from "@gassi/domain";
import type { ListTone } from "../theme";
import type { IconName } from "./Icon";

export const TYPE_ICON: Record<EntryType, IconName> = {
  walk: "walk",
  food: "food",
  training: "training",
  pee: "pee",
  poop: "poop",
  weight: "weight",
  note: "note",
  restock: "restock",
  stockcheck: "stock",
};

/** The color of each entry type: the dot and strip of its row in Verlauf. */
export const TYPE_TONE: Record<EntryType, ListTone> = {
  walk: "walk",
  food: "food",
  training: "training",
  pee: "pee",
  poop: "poop",
  weight: "weight",
  note: "device",
  restock: "food",
  stockcheck: "food",
};
