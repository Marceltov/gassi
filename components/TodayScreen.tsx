"use client";

import { useTransition } from "react";
import { logEntry } from "@/app/actions";
import type { TodayView } from "@/backend";
import type { EntryType } from "@/shared/entryTypes";
import { dayHeading } from "@/shared/time";
import { EntryList } from "./EntryList";
import { TodayTiles } from "./TodayTiles";
import { useEntrySheet } from "./useEntrySheet";
import { useNow } from "./useNow";

// Heute: the tiles, then today's entries. The server action refreshes the page's data after every change.
export function TodayScreen({ view }: { view: TodayView }) {
  const now = useNow(view.now);
  const sheet = useEntrySheet(view.timeZone);
  const [busy, startTransition] = useTransition();

  const quickLog = (type: EntryType) =>
    startTransition(async () => {
      const r = await logEntry({ type, at: new Date().toISOString() });
      if (r.ok) sheet.logged(r.value);
      else sheet.show(r.error);
    });

  return (
    <>
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Heute</h1>
        <p className="text-muted">{dayHeading(now, view.timeZone)}</p>
      </header>
      <TodayTiles tiles={view.tiles} now={now} busy={busy} onLog={quickLog} onDetails={sheet.openNew} />
      <section aria-labelledby="today-list" className="mt-8">
        <h2 id="today-list" className="mb-2 text-xl font-bold">
          Was heute mit {view.dogName} war
        </h2>
        {view.entries.length > 0 ? <EntryList entries={view.entries} timeZone={view.timeZone} onSelect={sheet.openEdit} /> : <p className="py-6 text-muted">Noch nichts eingetragen. Tipp oben auf eine Kachel, wenn etwas passiert.</p>}
      </section>
      {sheet.ui}
    </>
  );
}
