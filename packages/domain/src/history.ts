// The Verlauf's days: entries, newest first, under the heading of the day they happened on.
import { dayHeading, dayOf } from "./time";

export type Day<T> = { day: string; heading: string; entries: T[] };

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
