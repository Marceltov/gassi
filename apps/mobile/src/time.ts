// Times as this phone shows them: in its own time zone.
import { clockTime } from "@gassi/domain";

export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "14:05" for an ISO instant. */
export const hhmm = (iso: string): string => clockTime(Date.parse(iso), TIME_ZONE);
