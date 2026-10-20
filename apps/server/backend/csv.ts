// The CSV export: every entry, oldest first, ";"-separated (what German spreadsheets expect), UTF-8 with BOM (so Excel
// reads the umlauts), CRLF lines, times in TZ, German headers.
import { FOOD_LABEL, TYPE_LABEL, utcToLocal } from "@gassi/domain";
import type { EntryView } from "./diary";

const HEADER = ["Datum", "Uhrzeit", "Art", "Ende", "Dauer (Min.)", "Pause (Min.)", "Futterart", "Menge (g)", "Übungen", "Leckerlis", "Notiz", "Von"];

/** A field quoted when it holds the separator, a quote or a line break; quotes inside are doubled. */
export function csvField(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(e: EntryView, timeZone: string): string[] {
  const [date, time] = utcToLocal(Date.parse(e.at), timeZone).split("T");
  const end = e.endedAt ? utcToLocal(Date.parse(e.endedAt), timeZone).replace("T", " ") : "";
  const by = e.walkers.length ? e.walkers.join(" + ") : e.byName;
  const n = (v: number | null) => (v === null ? "" : String(v));
  return [date, time, TYPE_LABEL[e.type], end, n(e.durationMin), e.pauseMin ? String(e.pauseMin) : "", e.foodKind ? FOOD_LABEL[e.foodKind] : "", n(e.amountG), e.exercises.join(", "), e.treats ? String(e.treats) : "", e.note ?? "", by];
}

/** `entries` newest first, as the diary lists them. */
export function entriesCsv(entries: readonly EntryView[], timeZone: string): string {
  const rows = [HEADER, ...[...entries].reverse().map((e) => row(e, timeZone))];
  return "﻿" + rows.map((r) => r.map(csvField).join(";")).join("\r\n") + "\r\n";
}
