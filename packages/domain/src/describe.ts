// How an entry reads in a list, the same in the apps.
import { detailLine, type EntryDetails } from "./details";
import { type EntryType, FOOD_LABEL, type FoodKind, TYPE_LABEL } from "./entryTypes";
import { exerciseRate, type ExerciseTotal, trainingParts } from "./exerciseTotals";
import { countLine, formatCanCount } from "./food";
import { cansOf } from "./stock";
import { formatMinutes } from "./time";

/** What happened during a walk: its pee, markings and poop, and the exercises of the trainings on it. */
export type WalkDuring = { pees: number; marks: number; poops: number; exercises: ExerciseTotal[] };

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
  details?: EntryDetails | null;
  distanceM?: number | null;
  during?: WalkDuring | null;
  /** a wet count's sizes, all of them */
  count?: readonly { unitG: number; amountG: number }[] | null;
};

export const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

/** A walk's distance: "850 m" under a kilometre, else "3,1 km". */
export const formatDistance = (m: number) => (m < 999.5 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`);

const grams = (g: number) => (g >= 1000 && g % 100 === 0 ? formatKg(g).replace(",0 kg", " kg") : `${g} g`);

/** How an entry reads in a list: "Gassi" + "52 Min. (8 Pause) · 3,1 km" + "Hirsch + Herzii", "Futter" +
 * "Nassfutter, 200 g" + "von Hirsch", "Poopoo" + "weich". `by` is who walked for walks with walkers, else "von <who logged it>"; `during`
 * is what happened on a walk ("2× Pipi · 5× markiert · 1× Poopoo · Sitz 4/5"), else empty. A training's exercises read with their
 * success: successes / repetitions. */
export function describeEntry(e: DescribableEntry): { title: string; extra: string; by: string; during: string } {
  const kind = e.foodKind ? FOOD_LABEL[e.foodKind] : "";
  const by = e.type === "walk" && e.walkers.length ? e.walkers.join(" + ") : `von ${e.byName}`;
  const duration = e.durationMin !== null ? formatMinutes(e.durationMin) : "";
  const running = !!e.clientKey && !e.endedAt;
  const plain = (title: string, extra: string) => ({ title, extra, by, during: "" });
  switch (e.type) {
    case "walk": {
      const time = running ? "läuft" : [duration, e.pauseMin ? `(${e.pauseMin} Pause)` : ""].filter(Boolean).join(" ");
      const d = e.during;
      const during = d ? [d.pees ? `${d.pees}× Pipi` : "", d.marks ? `${d.marks}× markiert` : "", d.poops ? `${d.poops}× Poopoo` : "", ...d.exercises.map(exerciseRate)].filter(Boolean).join(" · ") : "";
      return { title: TYPE_LABEL.walk, extra: [time, e.distanceM ? formatDistance(e.distanceM) : ""].filter(Boolean).join(" · "), by, during };
    }
    case "training":
      return plain(TYPE_LABEL.training, [running ? "läuft" : duration, ...trainingParts(e.exercises, e.treats ?? 0)].filter(Boolean).join(" · "));
    case "weight":
      return plain(TYPE_LABEL.weight, e.amountG ? formatKg(e.amountG) : "");
    case "restock": {
      const amount = e.unitG && e.amountG ? `${Math.round(e.amountG / e.unitG)} × ${e.unitG} g` : e.amountG ? grams(e.amountG) : "";
      return plain([TYPE_LABEL.restock, kind].filter(Boolean).join(" "), amount);
    }
    case "poop":
    case "dogEncounter":
    case "personEncounter":
      return plain(TYPE_LABEL[e.type], detailLine(e.type, e.details ?? null));
    case "opened":
      return plain(TYPE_LABEL.opened, e.unitG ? `${e.unitG}-g-Dose` : "");
    case "stockcheck":
      // a wet count is one entry per can size, in whole closed cans
      return plain([TYPE_LABEL.stockcheck, kind].filter(Boolean).join(" "), e.count?.length ? countLine(e.count) : e.amountG === null ? "" : e.unitG ? formatCanCount({ unitG: e.unitG, cans: cansOf(e.amountG, e.unitG) }) : grams(e.amountG));
    default:
      return plain(TYPE_LABEL[e.type], [duration, kind, e.amountG ? `${e.amountG} g` : ""].filter(Boolean).join(", "));
  }
}
