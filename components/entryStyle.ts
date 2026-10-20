// How each entry type looks: its Tabler icon and its colour (a CSS variable from globals.css).
import { IconBone, IconDroplet, IconNote, IconPoo, IconWalk, type Icon } from "@tabler/icons-react";
import type { EntryType } from "@/shared/entryTypes";

export const TYPE_ICON: Record<EntryType, Icon> = { walk: IconWalk, food: IconBone, pee: IconDroplet, poop: IconPoo, note: IconNote };

export const TYPE_COLOR: Record<EntryType, string> = { walk: "var(--walk)", food: "var(--food)", pee: "var(--pee)", poop: "var(--poop)", note: "var(--note)" };

/** The optional details of an entry in a few words: "30 Min.", "200 g". */
export function details(e: { durationMin: number | null; amountG: number | null }): string[] {
  return [e.durationMin ? `${e.durationMin} Min.` : "", e.amountG ? `${e.amountG} g` : ""].filter(Boolean);
}
