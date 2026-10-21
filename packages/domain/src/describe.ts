// How an entry reads in a list, the same in the apps.
import type { ExerciseTotal } from "./exerciseTotals";
import { type EntryType, FOOD_LABEL, type FoodKind, TYPE_LABEL } from "./entryTypes";

/** The fields of an entry that its description needs (the server's entry view has them all). */
export type DescribableEntry = {
  type: EntryType;
  durationMin: number | null;
  amountG: number | null;
  foodKind: FoodKind | null;
  unitG: number | null;
  clientKey: string | null;
  endedAt: string | null;
  walkers: string[];
  pauseMin: number | null;
  exercises: ExerciseTotal[];
  treats: number | null;
  byName: string;
};

export const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

const grams = (g: number) => (g >= 1000 && g % 100 === 0 ? formatKg(g).replace(",0 kg", " kg") : `${g} g`);

/** How an entry reads in a list: "Gassi" + "52 Min. (8 Pause)" + "Hirsch + Herzii", "Futter" + "Nassfutter, 200 g" +
 * "von Hirsch". `by` is who walked for walks with walkers, else "von <who logged it>". */
export function describeEntry(e: DescribableEntry): { title: string; extra: string; by: string } {
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
      const tail = [e.exercises.map((x) => x.name).join(", "), treats].filter(Boolean).join(", ");
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
