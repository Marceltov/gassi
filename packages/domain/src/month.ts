// A calendar month ("2026-10") for the month views: which one an instant falls in, stepping, its German name, and its
// days as whole weeks from Monday (the neighbouring months' days marked).
import { addDays, mondayOf } from "./week";
import { localToUtc, utcToLocal } from "./time";

export type CalendarDay = { date: string; inMonth: boolean };

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** The month `ms` falls in, in `timeZone`: "2026-10". */
export const monthOf = (ms: number, timeZone: string): string => utcToLocal(ms, timeZone).slice(0, 7);

/** "2026-10" + n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** "Oktober 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** The month's days as weeks from Monday to Sunday; days of the months around it fill the first and last week. */
export function monthGrid(month: string): CalendarDay[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks: CalendarDay[][] = [];
  for (let monday = mondayOf(Date.parse(`${first}T12:00:00Z`), "UTC"); monday <= last; monday = addDays(monday, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((date) => ({ date, inMonth: date.startsWith(month) })));
  return weeks;
}

/** Noon of `day` in `timeZone`, as an instant: when something logged for a whole day goes in. */
export const noonOf = (day: string, timeZone: string): string => new Date(localToUtc(`${day}T12:00`, timeZone)).toISOString();
