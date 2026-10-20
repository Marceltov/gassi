"use client";

import { useCallback, useState, useTransition } from "react";
import { loadHistory } from "@/app/actions";
import type { EntryView, HistoryFilter, HistoryPage } from "@/backend";
import { dayBounds, dayHeading, dayOf } from "@/shared/time";
import { EntryList } from "./EntryList";
import { type EntryChange, useEntrySheet } from "./useEntrySheet";

type Props = { filter: HistoryFilter; first: HistoryPage; timeZone: string; now: string };

// Verlauf: entries newest first, grouped by day, 50 at a time. The first page comes from the server (and is refreshed
// after every change); pages loaded with "Mehr laden" are kept here and patched when an entry in them changes.
export function HistoryScreen({ filter, first, timeZone, now }: Props) {
  const [extra, setExtra] = useState<EntryView[]>([]);
  const [more, setMore] = useState(first.more);
  const [loading, startLoading] = useTransition();
  const onChange = useCallback((c: EntryChange) => setExtra((xs) => patch(xs, c)), []);
  const sheet = useEntrySheet(timeZone, onChange);
  const entries = merge(first.entries, extra);

  const loadMore = () =>
    startLoading(async () => {
      const page = await loadHistory(filter, entries.length);
      setExtra((xs) => [...xs, ...page.entries]);
      setMore(page.more);
    });

  if (entries.length === 0) return <p className="py-10 text-center text-muted">Keine Einträge für diese Auswahl.</p>;
  return (
    <>
      {byDay(entries, timeZone).map(([day, list]) => (
        <section key={day} aria-label={dayLabel(list[0].at, now, timeZone)} className="mt-6">
          <h2 className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-2 text-lg font-bold backdrop-blur">{dayLabel(list[0].at, now, timeZone)}</h2>
          <EntryList entries={list} timeZone={timeZone} onSelect={sheet.openEdit} />
        </section>
      ))}
      {more && (
        <button type="button" onClick={loadMore} disabled={loading} className="mt-6 min-h-14 w-full rounded-2xl border-2 border-line bg-surface text-lg font-bold disabled:opacity-60">
          {loading ? "Lädt …" : "Mehr laden"}
        </button>
      )}
      {sheet.ui}
    </>
  );
}

const newestFirst = (a: EntryView, b: EntryView) => b.at.localeCompare(a.at) || b.id - a.id;

/** The server's page and the loaded ones, without duplicates (a deletion shifts the pages), newest first. */
function merge(first: EntryView[], extra: EntryView[]): EntryView[] {
  const ids = new Set(first.map((e) => e.id));
  return [...first, ...extra.filter((e) => !ids.has(e.id))].sort(newestFirst);
}

function patch(entries: EntryView[], { kind, entry }: EntryChange): EntryView[] {
  if (kind === "deleted") return entries.filter((e) => e.id !== entry.id);
  return entries.map((e) => (e.id === entry.id ? entry : e));
}

function byDay(entries: EntryView[], timeZone: string): [string, EntryView[]][] {
  const days = new Map<string, EntryView[]>();
  for (const e of entries) {
    const day = dayOf(Date.parse(e.at), timeZone);
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  return [...days];
}

function dayLabel(at: string, now: string, timeZone: string): string {
  const ms = Date.parse(at);
  const today = dayBounds(Date.parse(now), timeZone);
  if (ms >= today.start) return "Heute";
  if (ms >= dayBounds(today.start - 1, timeZone).start) return "Gestern";
  return dayHeading(ms, timeZone);
}
