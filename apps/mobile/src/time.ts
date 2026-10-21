// Times as this phone shows them: in its own time zone.
import { clockTime } from "@gassi/domain";

export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "14:05" for an ISO instant. */
export const hhmm = (iso: string): string => clockTime(Date.parse(iso), TIME_ZONE);

/** "Mi., 22. Okt., 14:05" for an ISO instant: a day this week or next, with its time. */
export const dayTime = (iso: string): string =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(Date.parse(iso));
