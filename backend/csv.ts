// The CSV export: every entry, oldest first, ";"-separated (what German spreadsheets expect), UTF-8 with BOM (so Excel
// reads the umlauts), CRLF lines, times in TZ, German headers.
import { TYPE_LABEL } from "../shared/entryTypes";
import { utcToLocal } from "../shared/time";
import type { EntryView } from "./diary";

const HEADER = ["Datum", "Uhrzeit", "Art", "Dauer (Min.)", "Menge (g)", "Notiz", "Von"];

/** A field quoted when it holds the separator, a quote or a line break; quotes inside are doubled. */
export function csvField(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(e: EntryView, timeZone: string): string[] {
  const [date, time] = utcToLocal(Date.parse(e.at), timeZone).split("T");
  return [date, time, TYPE_LABEL[e.type], String(e.durationMin ?? ""), String(e.amountG ?? ""), e.note ?? "", e.byName];
}

/** `entries` newest first, as the diary lists them. */
export function entriesCsv(entries: readonly EntryView[], timeZone: string): string {
  const rows = [HEADER, ...[...entries].reverse().map((e) => row(e, timeZone))];
  return "﻿" + rows.map((r) => r.map(csvField).join(";")).join("\r\n") + "\r\n";
}
