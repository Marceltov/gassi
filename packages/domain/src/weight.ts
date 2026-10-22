// A dog's weight: kg as typed into grams (to the 100 g, as stored), the weight of each day, and how it changed.
import { formatKg } from "./describe";
import { weightInput } from "./inputs";
import { dayOf } from "./time";

type Weight = { id: number; at: string; amountG: number | null };

/** Kg as typed ("12,4") in grams to the 100 g, or null when it isn't a weight between 0,5 and 100 kg. */
export function kgToGrams(kg: string | number): number | null {
  const r = weightInput.shape.kg.safeParse(kg);
  return r.success ? Math.round(r.data * 10) * 100 : null;
}

/** Each local day's weight: the newest of that day. `weights` newest first. */
export function weightsByDay<W extends Weight>(weights: readonly W[], timeZone: string): Map<string, W> {
  const days = new Map<string, W>();
  for (const w of weights) {
    const day = dayOf(Date.parse(w.at), timeZone);
    if (!days.has(day)) days.set(day, w);
  }
  return days;
}

/** The newest weight against the one before it: "−2,0 kg seit 15.10.", "gleich seit 15.10."; null with fewer than two.
 * `weights` newest first. */
export function weightChange(weights: readonly Weight[], timeZone: string): string | null {
  const [now, before] = weights;
  if (!now || !before) return null;
  const since = dayOf(Date.parse(before.at), timeZone);
  const when = `seit ${since.slice(8)}.${since.slice(5, 7)}.`;
  const diff = (now.amountG ?? 0) - (before.amountG ?? 0);
  if (diff === 0) return `gleich ${when}`;
  return `${diff > 0 ? "+" : "−"}${formatKg(Math.abs(diff))} ${when}`;
}
