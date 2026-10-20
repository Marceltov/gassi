// How each entry type looks: its Tabler icon and its colour (a CSS variable from globals.css).
import { IconBone, IconDroplet, IconNote, IconPoo, IconScale, IconShoppingCart, IconTarget, IconWalk, IconClipboardCheck, type Icon } from "@tabler/icons-react";
import type { EntryView } from "@/backend";
import { type EntryType, FOOD_LABEL, TYPE_LABEL } from "@/shared/entryTypes";

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

const grams = (g: number) => (g >= 1000 && g % 100 === 0 ? formatKg(g).replace(",0 kg", " kg") : `${g} g`);

/** How an entry reads in a list: "Gassi" + "52 Min. (8 Pause)" + "Hirsch + Herzii", "Futter" + "Nassfutter, 200 g" +
 * "von Hirsch". `by` is who walked for walks with walkers, else "von <who logged it>". */
export function describeEntry(e: EntryView): { title: string; extra: string; by: string } {
  const kind = e.foodKind ? FOOD_LABEL[e.foodKind] : "";
  const by = e.type === "walk" && e.walkers.length ? e.walkers.join(" + ") : `von ${e.byName}`;
  const duration = e.durationMin !== null ? `${e.durationMin} Min.` : "";
  switch (e.type) {
    case "walk": {
      const running = e.clientKey && !e.endedAt;
      return { title: TYPE_LABEL.walk, extra: running ? "läuft" : [duration, e.pauseMin ? `(${e.pauseMin} Pause)` : ""].filter(Boolean).join(" "), by };
    }
    case "training": {
      const treats = e.treats ? `${e.treats} ${e.treats === 1 ? "Leckerli" : "Leckerlis"}` : "";
      const head = e.clientKey && !e.endedAt ? "läuft" : duration;
      const tail = [e.exercises.join(", "), treats].filter(Boolean).join(", ");
      return { title: TYPE_LABEL.training, extra: e.exercises.length ? `${head}: ${tail}` : [head, treats].filter(Boolean).join(", "), by };
    }
    case "weight":
      return { title: TYPE_LABEL.weight, extra: e.amountG ? formatKg(e.amountG) : "", by };
    case "restock": {
      const amount = e.unitG && e.amountG ? `${Math.round(e.amountG / e.unitG)} × ${e.unitG} g` : e.amountG ? grams(e.amountG) : "";
      return { title: [TYPE_LABEL.restock, kind].filter(Boolean).join(" "), extra: amount, by };
    }
    case "stockcheck":
      return { title: [TYPE_LABEL.stockcheck, kind].filter(Boolean).join(" "), extra: e.amountG !== null ? grams(e.amountG) : "", by };
    default:
      return { title: TYPE_LABEL[e.type], extra: [duration, kind, e.amountG ? `${e.amountG} g` : ""].filter(Boolean).join(", "), by };
  }
}
