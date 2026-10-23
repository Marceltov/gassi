// The running walk's pee/markings/poop and trainings: the server's summary of the walk (asked for by its key whenever the
// walk's view changes: a tap, an answer, a refresh), with this phone's unsent taps laid over. A tap that has just left
// the queue stays shown until a summary from the server holds it, so nothing blinks out in between.
import type { WalkView } from "@gassi/domain";
import { useEffect, useRef, useState } from "react";
import { useGassi } from "../data/GassiProvider";
import { holds, mergeTaps, type Names, summaryTaps, type Tap, tapsOf, type WalkSummary, withConsistencies } from "./taps";

/** The household's exercise and treat names, for the commands this phone tapped. */
export function useTapNames(): Names {
  const { exercises, treatKinds } = useGassi();
  return { exercise: (id) => exercises.find((e) => e.id === id)?.name ?? "Übung", treat: (id) => treatKinds.find((t) => t.id === id)?.name ?? "Leckerli" };
}

type Known = { key: string; taps: Tap[]; trainings: WalkSummary["trainings"] };

export function useWalkTaps(walk: WalkView | null): { taps: Tap[]; trainings: WalkSummary["trainings"] } {
  const { api, pending } = useGassi();
  const names = useTapNames();
  const [known, setKnown] = useState<Known | null>(null);
  const [carried, setCarried] = useState<Tap[]>([]);
  const [lastPending, setLastPending] = useState(pending);
  if (pending !== lastPending) {
    setLastPending(pending);
    setCarried((c) => [...c, ...tapsOf(lastPending, names).filter((t) => !holds(c, t))]);
  }

  // only an answer newer than the one shown is applied
  const asked = useRef(0);
  const shown = useRef(0);
  useEffect(() => {
    if (!api || !walk) return;
    const n = ++asked.current;
    api.walkByKey({ key: walk.key }).then(
      ({ summary }) => {
        if (n < shown.current) return;
        shown.current = n;
        const taps = summaryTaps(summary);
        setKnown({ key: walk.key, taps, trainings: summary.trainings });
        setCarried((c) => c.filter((t) => !holds(taps, t)));
      },
      () => {}, // no reception, or the server doesn't know the walk yet: the unsent taps show meanwhile
    );
  }, [api, walk]);

  if (!walk) return { taps: [], trainings: [] };
  const mine = known?.key === walk.key ? known : null;
  const taps = mergeTaps(mine?.taps ?? [], [...carried, ...tapsOf(pending, names)], walk.startedAt, null);
  return { taps: withConsistencies(taps, pending), trainings: mine?.trainings ?? [] };
}
