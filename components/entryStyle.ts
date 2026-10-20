// How each entry type looks: its Tabler icon and its colour (a CSS variable from globals.css).
import { IconBone, IconDroplet, IconNote, IconPoo, IconScale, IconShoppingCart, IconTarget, IconWalk, IconClipboardCheck, type Icon } from "@tabler/icons-react";
import { type EntryType, FOOD_LABEL, type FoodKind } from "@/shared/entryTypes";

export const TYPE_ICON: Record<EntryType, Icon> = {
  walk: IconWalk,
  food: IconBone,
  pee: IconDroplet,
  poop: IconPoo,
  note: IconNote,
  training: IconTarget,
  weight: IconScale,
  restock: IconShoppingCart,
  stockcheck: IconClipboardCheck,
};

export const TYPE_COLOR: Record<EntryType, string> = {
  walk: "var(--walk)",
  food: "var(--food)",
  pee: "var(--pee)",
  poop: "var(--poop)",
  note: "var(--note)",
  training: "var(--training)",
  weight: "var(--note)",
  restock: "var(--food)",
  stockcheck: "var(--food)",
};

export const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

/** The optional details of an entry in a few words: "30 Min.", "Nassfutter", "200 g", "12,4 kg". */
export function details(e: { type: EntryType; durationMin: number | null; amountG: number | null; foodKind: FoodKind | null }): string[] {
  const amount = !e.amountG ? "" : e.type === "weight" ? formatKg(e.amountG) : `${e.amountG} g`;
  return [e.durationMin ? `${e.durationMin} Min.` : "", e.foodKind ? FOOD_LABEL[e.foodKind] : "", amount].filter(Boolean);
}
