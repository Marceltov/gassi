"use client";

import { IconDots } from "@tabler/icons-react";
import type { EntryView, TodayView, WalkView } from "@/backend";
import { TILE_TYPES, TYPE_LABEL, type EntryType } from "@/shared/entryTypes";
import { formatAgo } from "@/shared/time";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";

type Props = {
  tiles: TodayView["tiles"];
  walk: WalkView | null; // the walk running now, if any
  now: number;
  busy: boolean;
  onLog: (type: EntryType) => void;
  onDetails: (type: EntryType) => void;
};

// The four big tiles: a tap logs "now, by me" (Gassi starts or opens a walk); the small "…" opens the sheet for time,
// duration, amount and note.
export function TodayTiles({ tiles, walk, now, busy, onLog, onDetails }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TILE_TYPES.map((type) => (
        <Tile key={type} type={type} last={tiles[type]} walk={type === "walk" ? walk : null} now={now} busy={busy} onLog={onLog} onDetails={onDetails} />
      ))}
    </div>
  );
}

function Tile({ type, last, walk, now, busy, onLog, onDetails }: { type: EntryType; last: EntryView | null } & Omit<Props, "tiles">) {
  const Icon = TYPE_ICON[type];
  const label = TYPE_LABEL[type];
  return (
    <div className="relative" style={{ "--c": TYPE_COLOR[type] } as React.CSSProperties}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onLog(type)}
        className="flex aspect-[1/1.05] w-full flex-col justify-between rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] p-4 text-left transition-transform active:scale-[0.97] disabled:opacity-70"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-(--c) text-surface">
          <Icon size={32} stroke={2} aria-hidden />
        </span>
        <span>
          <span className="block text-2xl font-extrabold tracking-tight">{label}</span>
          {walk ? <WalkStatus walk={walk} now={now} /> : <TileStatus last={last} now={now} />}
        </span>
      </button>
      <button type="button" onClick={() => onDetails(type)} aria-label={`Details für ${label}`} className="absolute top-2 right-2 flex size-12 items-center justify-center rounded-full text-ink/70">
        <IconDots size={26} aria-hidden />
      </button>
    </div>
  );
}

function WalkStatus({ walk, now }: { walk: WalkView; now: number }) {
  const min = Math.max(0, Math.floor((now - Date.parse(walk.startedAt)) / 60_000));
  return (
    <span className="flex min-h-[3.25rem] flex-col justify-start leading-tight">
      <span className="text-xl font-extrabold tabular-nums">läuft seit {min} Min.</span>
      <span className="sr-only"> · </span>
      <span className="text-muted">{walk.walkers.map((w) => w.name).join(" + ")}</span>
    </span>
  );
}

// Two lines high either way, so the labels of neighbouring tiles line up. The time since is what matters at the door;
// who did it comes second, on its own line (the " · " is for screen readers and the text the tile is read as).
function TileStatus({ last, now }: { last: EntryView | null; now: number }) {
  return (
    <span className="flex min-h-[3.25rem] flex-col justify-start leading-tight">
      {last ? (
        <>
          <span className="text-xl font-extrabold tabular-nums">{formatAgo(Date.parse(last.at), now)}</span>
          <span className="sr-only"> · </span>
          <span className="text-muted">{last.byName}</span>
        </>
      ) : (
        <span className="text-muted">heute noch nicht</span>
      )}
    </span>
  );
}
