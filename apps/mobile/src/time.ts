// Times as this phone shows them: in its own time zone.
import { clockTime, dayOf } from "@gassi/domain";

export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "14:05" for an ISO instant. */
export const hhmm = (iso: string): string => clockTime(Date.parse(iso), TIME_ZONE);

/** "Mi., 22. Okt., 14:05" for an ISO instant: a day this week or next, with its time. */
export const dayTime = (iso: string): string =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(Date.parse(iso));

/** "heute", "gestern", else "21.10." (and the year when it isn't this one), for an ISO instant seen at `now` (ms). */
export function shortDay(iso: string, now: number): string {
  const day = dayOf(Date.parse(iso), TIME_ZONE);
  if (day === dayOf(now, TIME_ZONE)) return "heute";
  if (day === dayOf(now - 86_400_000, TIME_ZONE)) return "gestern";
  const [y, m, d] = day.split("-").map(Number);
  return `${d}.${m}.${y === Number(dayOf(now, TIME_ZONE).slice(0, 4)) ? "" : y}`;
}
