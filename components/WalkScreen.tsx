"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { IconHome, IconPlayerPause, IconPlayerPlay, IconTarget, IconUserPlus, IconWalk } from "@tabler/icons-react";
import type { SessionsView, User, WalkSummary as Summary, WalkView } from "@/backend";
import { TYPE_LABEL } from "@/shared/entryTypes";
import { clockTime, formatElapsed } from "@/shared/time";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";
import { PendingHint } from "./PendingHint";
import { Toast, type ToastMessage } from "./Toast";
import { useLiveRefresh } from "./useLiveRefresh";
import { useTicker } from "./useNow";
import { newId, useSessions, walkerNames } from "./useSessions";
import { WalksSince } from "./WalksSince";
import { WalkSummary } from "./WalkSummary";

type Props = { view: SessionsView; user: User; timeZone: string; finishedKey: string | null; summary: Summary | null };

/** Minutes paused so far, an open pause counted up to `now`. */
export function pausedMs(walk: Pick<WalkView, "pauses">, now: number): number {
  return walk.pauses.reduce((sum, p) => sum + Math.max(0, (p.endedAt ? Date.parse(p.endedAt) : now) - Date.parse(p.startedAt)), 0);
}

// /runde: the walk while it runs (big clock, Pipi, Poopoo, Pause, Training, Zuhause), "Mitgehen" for someone not on
// it, and after Zuhause its summary (/runde?fertig=<key>).
export function WalkScreen({ view: initial, user, timeZone, finishedKey, summary }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const { view, pending, push } = useSessions(initial, user, finishedKey ? refresh : undefined);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  useLiveRefresh();
  const walk = view.walk;

  if (finishedKey && walk?.key !== finishedKey) return <WalkSummary summary={summary} timeZone={timeZone} pending={pending} />;

  if (!walk)
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Runde</h1>
        <p className="text-muted">Gerade läuft keine Runde.</p>
        <button type="button" onClick={() => void push({ kind: "walk.start", walkKey: newId() })} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-ink">
          <IconWalk size={28} aria-hidden /> Los geht&apos;s
        </button>
        <Link href="/" className="min-h-12 py-3 font-semibold text-muted">
          Zurück zu Heute
        </Link>
        <PendingHint count={pending} />
      </div>
    );

  const onWalk = walk.walkers.some((w) => w.username === user.username);
  const log = (type: "pee" | "poop") => {
    void push({ kind: "log", type });
    setToast({ id: Date.now(), text: `${TYPE_LABEL[type]} eingetragen` });
  };
  const training = () => {
    const trainingKey = view.training?.key ?? newId();
    const started = view.training ? Promise.resolve() : push({ kind: "training.start", trainingKey, walkKey: walk.key });
    void started.then(() => router.push("/training"));
  };
  const home = () => void push({ kind: "walk.stop", walkKey: walk.key }).then(() => router.replace(`/runde?fertig=${encodeURIComponent(walk.key)}`));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Runde</h1>
        <p className="text-lg text-muted">{walkerNames(walk.walkers)}</p>
      </header>
      <WalkClock walk={walk} timeZone={timeZone} />

      {!onWalk ? (
        <>
          <p className="text-center text-lg">
            <WalksSince walk={walk} /> unterwegs.
          </p>
          <button type="button" onClick={() => void push({ kind: "walk.join", walkKey: walk.key })} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-ink">
            <IconUserPlus size={26} aria-hidden /> Mitgehen
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <BigButton type="pee" onClick={() => log("pee")} />
            <BigButton type="poop" onClick={() => log("poop")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void push({ kind: walk.paused ? "walk.resume" : "walk.pause", walkKey: walk.key })} className={`${secondary} ${walk.paused ? "border-primary bg-primary/15" : ""}`}>
              {walk.paused ? <IconPlayerPlay size={26} aria-hidden /> : <IconPlayerPause size={26} aria-hidden />}
              {walk.paused ? "Weiter" : "Pause"}
            </button>
            <button type="button" onClick={training} className={secondary} style={{ "--c": TYPE_COLOR.training } as React.CSSProperties}>
              <IconTarget size={26} aria-hidden className="text-(--c)" />
              {view.training ? "Zum Training" : "Training"}
            </button>
          </div>
          <button type="button" onClick={home} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-ink">
            <IconHome size={26} aria-hidden /> Zuhause
          </button>
        </>
      )}
      <PendingHint count={pending} />
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

const secondary = "flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface text-lg font-bold";

function WalkClock({ walk, timeZone }: { walk: WalkView; timeZone: string }) {
  const now = useTicker();
  const started = Date.parse(walk.startedAt);
  const pauseMin = now === null ? 0 : Math.floor(pausedMs(walk, now) / 60_000);
  return (
    <div className="rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] px-4 py-6 text-center" style={{ "--c": TYPE_COLOR.walk } as React.CSSProperties}>
      <p className="text-7xl font-extrabold tracking-tight tabular-nums" aria-label="Dauer der Runde">
        {now === null ? "0:00" : formatElapsed(now - started)}
      </p>
      <p className="mt-2 text-lg text-muted">
        seit {clockTime(started, timeZone)}
        {pauseMin > 0 && <>, davon {pauseMin} Min. Pause</>}
      </p>
      {walk.paused && <p className="mt-2 inline-block rounded-full bg-ink px-3 py-1 font-bold text-bg">Pause</p>}
    </div>
  );
}

function BigButton({ type, onClick }: { type: "pee" | "poop"; onClick: () => void }) {
  const Icon = TYPE_ICON[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] text-2xl font-extrabold transition-transform active:scale-[0.97]"
      style={{ "--c": TYPE_COLOR[type] } as React.CSSProperties}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-(--c) text-surface">
        <Icon size={28} stroke={2} aria-hidden />
      </span>
      {TYPE_LABEL[type]}
    </button>
  );
}
