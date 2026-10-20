"use client";

import type { EntryView } from "@/backend";
import { TYPE_LABEL } from "@/shared/entryTypes";
import { clockTime } from "@/shared/time";
import { details, TYPE_COLOR, TYPE_ICON } from "./entryStyle";

// A timeline of entries, newest first: the time, the type's coloured mark on one line, what and who. Tapping an
// entry opens it for editing.
export function EntryList({ entries, timeZone, onSelect }: { entries: EntryView[]; timeZone: string; onSelect: (e: EntryView) => void }) {
  return (
    <ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[4.25rem] before:w-0.5 before:bg-line">
      {entries.map((e) => (
        <li key={e.id}>
          <EntryRow entry={e} timeZone={timeZone} onSelect={onSelect} />
        </li>
      ))}
    </ol>
  );
}

function EntryRow({ entry: e, timeZone, onSelect }: { entry: EntryView; timeZone: string; onSelect: (e: EntryView) => void }) {
  const Icon = TYPE_ICON[e.type];
  const extra = details(e).join(", ");
  return (
    <button type="button" onClick={() => onSelect(e)} className="relative flex min-h-16 w-full items-start gap-3 rounded-xl py-2 text-left active:bg-line/40" style={{ "--c": TYPE_COLOR[e.type] } as React.CSSProperties}>
      <time dateTime={e.at} className="w-12 shrink-0 pt-1.5 text-right font-bold tabular-nums">
        {clockTime(Date.parse(e.at), timeZone)}
      </time>
      <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--c) text-surface ring-4 ring-bg">
        <Icon size={20} stroke={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 pt-1">
        <span className="block">
          <strong className="font-bold">{TYPE_LABEL[e.type]}</strong>
          {extra && <span className="text-ink">, {extra}</span>}
          <span className="text-muted"> von {e.byName}</span>
        </span>
        {e.note && <span className="mt-0.5 block break-words text-muted">{e.note}</span>}
      </span>
    </button>
  );
}
