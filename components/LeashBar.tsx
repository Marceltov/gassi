"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconTarget, IconWalk } from "@tabler/icons-react";
import type { SessionsView, User } from "@/backend";
import { TYPE_LABEL } from "@/shared/entryTypes";
import { formatElapsed } from "@/shared/time";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";
import { Toast, type ToastMessage } from "./Toast";
import { useLiveRefresh } from "./useLiveRefresh";
import { useTicker } from "./useNow";
import { useSessions, walkerNames, walkersAre } from "./useSessions";

// The leash bar: while a walk runs, a strip above the bottom nav on every screen but the walk screen itself, with the
// walk's clock (one tap back to it) and, for those on the walk, Pipi and Poopoo in one tap. While only a training
// runs, it shows the training instead. It sets data-dock on <html> so pages keep clear of it.
export function LeashBar({ initial, user }: { initial: SessionsView; user: User }) {
  const path = usePathname();
  const { view, push } = useSessions(initial, user);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const walk = view.walk && path !== "/runde" ? view.walk : null;
  const training = !walk && view.training && path !== "/training" && path !== "/runde" ? view.training : null;
  const shown = Boolean(walk || training);

  useEffect(() => {
    if (!shown) return;
    document.documentElement.dataset.dock = "";
    return () => {
      delete document.documentElement.dataset.dock;
    };
  }, [shown]);

  const now = useTicker(30_000);
  if (!walk && !training) return null;

  const log = (type: "pee" | "poop") => {
    void push({ kind: "log", type });
    setToast({ id: Date.now(), text: `${TYPE_LABEL[type]} eingetragen` });
  };

  return (
    <section aria-label={walk ? "Laufende Runde" : "Laufendes Training"} className="border-b border-line" style={{ "--c": walk ? TYPE_COLOR.walk : TYPE_COLOR.training } as React.CSSProperties}>
      <Refresh />
      <div className="mx-auto flex h-[4.25rem] max-w-xl items-center gap-2 px-3">
        {walk ? (
          <>
            <Link href="/runde" aria-label={`Zur Runde: ${walkersAre(walk.walkers)} seit ${now === null ? 0 : Math.max(0, Math.floor((now - Date.parse(walk.startedAt)) / 60_000))} Min. unterwegs`} className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl bg-(--c) px-3 text-surface">
              <IconWalk size={28} aria-hidden />
              <span className="flex flex-col leading-tight">
                <Clock since={walk.startedAt} />
                <span className="text-sm opacity-90">{walk.paused ? "Pause" : walkerNames(walk.walkers)}</span>
              </span>
            </Link>
            {walk.walkers.some((w) => w.username === user.username) && (
              <>
                <LogButton type="pee" onClick={() => log("pee")} />
                <LogButton type="poop" onClick={() => log("poop")} />
              </>
            )}
          </>
        ) : (
          <Link href="/training" aria-label="Zum Training" className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl bg-(--c) px-3 text-surface">
            <IconTarget size={28} aria-hidden />
            <span className="flex flex-col leading-tight">
              <Clock since={training!.startedAt} />
              <span className="text-sm opacity-90">Training läuft</span>
            </span>
          </Link>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}

// Only while something runs: the other phone's stop shows up here within 30 s.
function Refresh() {
  useLiveRefresh();
  return null;
}

function Clock({ since }: { since: string }) {
  const now = useTicker();
  return <span className="text-2xl font-extrabold tabular-nums">{now === null ? "0:00" : formatElapsed(now - Date.parse(since))}</span>;
}

function LogButton({ type, onClick }: { type: "pee" | "poop"; onClick: () => void }) {
  const Icon = TYPE_ICON[type];
  return (
    <button type="button" onClick={onClick} aria-label={`${TYPE_LABEL[type]} eintragen`} className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-bold text-surface active:scale-95" style={{ background: TYPE_COLOR[type] }}>
      <Icon size={26} stroke={2} aria-hidden />
      {TYPE_LABEL[type]}
    </button>
  );
}
