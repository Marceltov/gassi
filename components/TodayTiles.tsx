"use client";

import { IconDots, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { EntryView, TodayView, TrainingView, WalkView } from "@/backend";
import { TYPE_LABEL, type EntryType } from "@/shared/entryTypes";
import { formatAgo } from "@/shared/time";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";
import { walkerNames } from "./useSessions";

type Props = {
  tiles: TodayView["tiles"];
  walk: WalkView | null; // the walk running now, if any
  training: TrainingView | null;
  onWalk: boolean; // this person is on the running walk: Pipi and Poopoo are in the leash bar then
  now: number;
  busy: boolean;
  onLog: (type: EntryType) => void;
  onDetails: (type: EntryType) => void;
  onTraining: () => void;
};

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
const ago = (e: EntryView | null, now: number) => (e ? formatAgo(Date.parse(e.at), now) : "heute noch nicht");

// Heute's controls, by how often they are needed on the way out: Gassi first and largest (it starts the walk and says
// when Toffee last peed and pooped, which is what tells you when to go out again), then Futter and Training, then Pipi
// and Poopoo "zwischendurch" (garden, an accident indoors); on a walk they are on the walk screen and in the leash
// bar instead.
export function TodayTiles({ tiles, walk, training, onWalk, now, busy, onLog, onDetails, onTraining }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <GassiCard last={tiles.walk} pee={tiles.pee} poop={tiles.poop} walk={walk} now={now} onLog={onLog} onDetails={onDetails} />
      <div className="grid grid-cols-2 gap-3">
        <Tile type="food" label={TYPE_LABEL.food} status={tiles.food ? <Ago e={tiles.food} now={now} /> : <span className="text-muted">heute noch nicht</span>} busy={busy} onClick={() => onLog("food")} onDetails={() => onDetails("food")} />
        <Tile
          type="training"
          label={training ? "Training läuft" : "Training starten"}
          status={training ? <span className="text-xl font-extrabold tabular-nums">seit {minutesSince(training.startedAt, now)} Min.</span> : <span className="text-muted">auf der Runde oder zu Hause</span>}
          busy={false}
          onClick={onTraining}
        />
      </div>
      {!onWalk && (
        <div role="group" aria-labelledby="between" className="flex flex-col gap-1.5">
          <span id="between" className="font-semibold text-muted">
            Zwischendurch
          </span>
          <div className="flex gap-2">
            {(["pee", "poop"] as const).map((type) => (
              <SmallLog key={type} type={type} busy={busy} onLog={onLog} onDetails={onDetails} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GassiCard({ last, pee, poop, walk, now, onLog, onDetails }: { last: EntryView | null; pee: EntryView | null; poop: EntryView | null; walk: WalkView | null; now: number } & Pick<Props, "onLog" | "onDetails">) {
  const Icon = TYPE_ICON.walk;
  return (
    <div className="relative" style={{ "--c": TYPE_COLOR.walk } as React.CSSProperties}>
      <button type="button" onClick={() => onLog("walk")} className="flex w-full flex-col gap-3 rounded-3xl bg-(--c) p-5 text-left text-surface transition-transform active:scale-[0.98]">
        <span className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface/20">
            <Icon size={34} stroke={2} aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-3xl font-extrabold tracking-tight">{walk ? "Gassi läuft" : "Gassi"}</span>
            {" "}
            <span className="text-lg font-semibold opacity-95">
              {walk ? (
                <>
                  seit {minutesSince(walk.startedAt, now)} Min. · {walkerNames(walk.walkers)}
                </>
              ) : last ? (
                <>
                  zuletzt {ago(last, now)} · {last.byName}
                </>
              ) : (
                "heute noch nicht"
              )}
            </span>
          </span>
        </span>
        <span className="sr-only"> · </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-base">
          <span>
            {TYPE_LABEL.pee} {ago(pee, now)}
          </span>
          <span className="sr-only"> · </span>
          <span>
            {TYPE_LABEL.poop} {ago(poop, now)}
          </span>
        </span>
        {!walk && (
          <span className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface text-lg font-extrabold text-(--c)">
            <IconPlayerPlayFilled size={20} aria-hidden /> Runde starten
          </span>
        )}
      </button>
      <button type="button" onClick={() => onDetails("walk")} aria-label="Details für Gassi" className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full text-surface/90">
        <IconDots size={26} aria-hidden />
      </button>
    </div>
  );
}

function Ago({ e, now }: { e: EntryView; now: number }) {
  return (
    <>
      <span className="block text-xl font-extrabold tabular-nums">{formatAgo(Date.parse(e.at), now)}</span>
      <span className="sr-only"> · </span>
      <span className="text-muted">{e.byName}</span>
    </>
  );
}

function Tile({ type, label, status, busy, onClick, onDetails }: { type: EntryType; label: string; status: React.ReactNode; busy: boolean; onClick: () => void; onDetails?: () => void }) {
  const Icon = TYPE_ICON[type];
  return (
    <div className="relative" style={{ "--c": TYPE_COLOR[type] } as React.CSSProperties}>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="flex min-h-40 w-full flex-col justify-between gap-3 rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] p-4 text-left transition-transform active:scale-[0.97] disabled:opacity-70"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-(--c) text-surface">
          <Icon size={28} stroke={2} aria-hidden />
        </span>
        <span>
          <span className="block text-xl leading-tight font-extrabold tracking-tight">{label}</span>
          <span className="sr-only"> · </span>
          <span className="block leading-tight">{status}</span>
        </span>
      </button>
      {onDetails && (
        <button type="button" onClick={onDetails} aria-label={`Details für ${label}`} className="absolute top-2 right-2 flex size-12 items-center justify-center rounded-full text-ink/70">
          <IconDots size={26} aria-hidden />
        </button>
      )}
    </div>
  );
}

function SmallLog({ type, busy, onLog, onDetails }: { type: "pee" | "poop" } & Pick<Props, "busy" | "onLog" | "onDetails">) {
  const Icon = TYPE_ICON[type];
  const label = TYPE_LABEL[type];
  return (
    <div className="flex flex-1 items-stretch overflow-hidden rounded-2xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))]" style={{ "--c": TYPE_COLOR[type] } as React.CSSProperties}>
      <button type="button" disabled={busy} onClick={() => onLog(type)} className="flex min-h-12 flex-1 items-center gap-2 pl-3 font-bold active:bg-(--c)/20 disabled:opacity-70">
        <Icon size={22} stroke={2} className="text-(--c)" aria-hidden />
        {label}
      </button>
      <button type="button" onClick={() => onDetails(type)} aria-label={`Details für ${label}`} className="flex w-11 items-center justify-center text-ink/60">
        <IconDots size={20} aria-hidden />
      </button>
    </div>
  );
}
