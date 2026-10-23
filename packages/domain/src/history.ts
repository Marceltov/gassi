// The Verlauf's days: entries, newest first, under the heading of the day they happened on; a wet count (one entry per
// can size at one time) is one row.
import type { EntryType, FoodKind } from "./entryTypes";
import { dayHeading, dayOf } from "./time";

export type Day<T> = { day: string; heading: string; entries: T[] };

/** `entries` with each wet count once: its first size stands for it (its detail and row show all of them). */
export function oneRowPerCount<T extends { at: string; type: EntryType; foodKind: FoodKind | null }>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (e.type !== "stockcheck" || e.foodKind !== "wet") return true;
    if (seen.has(e.at)) return false;
    seen.add(e.at);
    return true;
  });
}

/** `entries` (newest first) by their day in `timeZone`: "Heute", "Gestern", else "Dienstag, 20. Oktober". */
export function byDay<T extends { at: string }>(entries: readonly T[], timeZone: string, nowMs: number): Day<T>[] {
  const today = dayOf(nowMs, timeZone);
  const yesterday = dayOf(Date.parse(`${today}T12:00:00Z`) - 86_400_000, timeZone);
  const days: Day<T>[] = [];
  for (const e of entries) {
    const ms = Date.parse(e.at);
    const day = dayOf(ms, timeZone);
    const last = days[days.length - 1];
    if (last?.day === day) last.entries.push(e);
    else days.push({ day, heading: day === today ? "Heute" : day === yesterday ? "Gestern" : dayHeading(ms, timeZone), entries: [e] });
  }
  return days;
}
