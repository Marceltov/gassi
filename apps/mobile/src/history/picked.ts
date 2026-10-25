// Android's pickers ask the day and the time in two dialogs, each in this phone's time zone (TimeField.tsx).

/** The day from the date dialog with the hour and minute from the time dialog, to the minute. */
export function picked(day: Date, time: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
}
