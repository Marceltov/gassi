// How an entry reads in a list, the same in the apps.
import { type EntryType, FOOD_LABEL, type FoodKind, TYPE_LABEL } from "./entryTypes";
import { exerciseRate, type ExerciseTotal } from "./exerciseTotals";
import { formatMinutes } from "./time";

/** What happened during a walk: its pee and poop, and the exercises of the trainings on it. */
export type WalkDuring = { pees: number; poops: number; exercises: ExerciseTotal[] };

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
  distanceM?: number | null;
  during?: WalkDuring | null;
};

export const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

/** A walk's distance: "850 m" under a kilometre, else "3,1 km". */
export const formatDistance = (m: number) => (m < 999.5 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`);

const grams = (g: number) => (g >= 1000 && g % 100 === 0 ? formatKg(g).replace(",0 kg", " kg") : `${g} g`);

const treatsText = (n: number | null) => (n ? `${n} ${n === 1 ? "Leckerli" : "Leckerlis"}` : "");

/** How an entry reads in a list: "Gassi" + "52 Min. (8 Pause) · 3,1 km" + "Hirsch + Herzii", "Futter" +
 * "Nassfutter, 200 g" + "von Hirsch". `by` is who walked for walks with walkers, else "von <who logged it>"; `during`
 * is what happened on a walk ("💧 2 · 💩 1 · 🎯 Sitz 4/5"), else empty. A training's exercises read with their
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
      const during = d ? [d.pees ? `💧 ${d.pees}` : "", d.poops ? `💩 ${d.poops}` : "", d.exercises.length ? `🎯 ${d.exercises.map(exerciseRate).join(" · ")}` : ""].filter(Boolean).join(" · ") : "";
      return { title: TYPE_LABEL.walk, extra: [time, e.distanceM ? formatDistance(e.distanceM) : ""].filter(Boolean).join(" · "), by, during };
    }
    case "training":
      return plain(TYPE_LABEL.training, [running ? "läuft" : duration, ...e.exercises.map(exerciseRate), treatsText(e.treats)].filter(Boolean).join(" · "));
    case "weight":
      return plain(TYPE_LABEL.weight, e.amountG ? formatKg(e.amountG) : "");
    case "restock": {
      const amount = e.unitG && e.amountG ? `${Math.round(e.amountG / e.unitG)} × ${e.unitG} g` : e.amountG ? grams(e.amountG) : "";
      return plain([TYPE_LABEL.restock, kind].filter(Boolean).join(" "), amount);
    }
    case "stockcheck":
      return plain([TYPE_LABEL.stockcheck, kind].filter(Boolean).join(" "), e.amountG !== null ? grams(e.amountG) : "");
    default:
      return plain(TYPE_LABEL[e.type], [duration, kind, e.amountG ? `${e.amountG} g` : ""].filter(Boolean).join(", "));
  }
}
