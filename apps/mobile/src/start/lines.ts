// The second line of Start's big tiles: when the last walk was and who went ("zuletzt vor 3 Std. · Herzii"), what the
// last feeding was ("zuletzt 80 g nass") and how the last training went ("Sitz 4/5 zuletzt"); before the first one,
// that there is none yet.
import { FOOD_SHORT, type FoodKind, formatAgo, trainingParts, type ExerciseTotal } from "@gassi/domain";

type Last = { at: string; endedAt: string | null; byName: string };
const ago = (e: Last, now: number) => formatAgo(Date.parse(e.endedAt ?? e.at), now);

export function lastWalk(walk: Last | null, now: number): string {
  return walk ? `zuletzt ${ago(walk, now)} · ${walk.byName}` : "noch keine Runde";
}

export function lastFeeding(food: (Last & { amountG?: number | null; foodKind?: FoodKind | null }) | null, now: number): string {
  if (!food) return "noch nichts gefüttert";
  return food.amountG && food.foodKind ? `zuletzt ${food.amountG} g ${FOOD_SHORT[food.foodKind].toLowerCase()}` : `zuletzt ${ago(food, now)}`;
}

export function lastTraining(training: (Last & { exercises: readonly ExerciseTotal[]; treats: number | null }) | null, now: number): string {
  if (!training) return "noch kein Training";
  const parts = trainingParts(training.exercises, training.treats ?? 0);
  return parts.length ? `${parts.join(" · ")} zuletzt` : `zuletzt ${ago(training, now)}`;
}
