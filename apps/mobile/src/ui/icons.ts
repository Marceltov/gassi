// The icon of each entry type, in Verlauf, its filter and an entry's detail.
import type { EntryType } from "@gassi/domain";
import type { ListTone } from "../theme";
import type { IconName } from "./Icon";

export const TYPE_ICON: Record<EntryType, IconName> = {
  walk: "walk",
  food: "food",
  training: "training",
  pee: "pee",
  mark: "mark",
  poop: "poop",
  weight: "weight",
  note: "note",
  dogEncounter: "dog",
  command: "training",
  treat: "treat",
  personEncounter: "people",
  restock: "restock",
  stockcheck: "stock",
  opened: "stock",
};

/** The color of each entry type: the dot and strip of its row in Verlauf. */
export const TYPE_TONE: Record<EntryType, ListTone> = {
  walk: "walk",
  food: "food",
  training: "training",
  pee: "pee",
  mark: "pee",
  poop: "poop",
  weight: "weight",
  note: "device",
  dogEncounter: "encounter",
  command: "training",
  treat: "treat",
  personEncounter: "encounter",
  restock: "food",
  stockcheck: "food",
  opened: "food",
};
