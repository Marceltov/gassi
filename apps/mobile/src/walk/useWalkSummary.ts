// A walk's summary by its id (from Verlauf) or by the key it was started with (right after "Zuhause", when the id
// may not be known). The server's summary once it holds the ended walk and nothing of it waits in the queue; until
// then, for the walk this phone ended, the one made from what the walk screen showed (`local`). Asked again when the
// queue or reception changes, and when the screen comes to the front again, so it switches over by itself.
import type { Output } from "@gassi/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { clearEnded, loadEnded } from "./ended";
import { fromEnded, fromServer, type Shown, tapsOf } from "./taps";

type Answer = Output<"walk">;
export type WalkSummaryState = { shown: Shown | null; track: Answer["track"]; local: boolean; error: string | null; reload(): void };

export function useWalkSummary(idOrKey: string): WalkSummaryState {
  const { api, pending, unsent, online } = useGassi();
  const [answer, setAnswer] = useState<{ for: string; data: Answer | null; error: string | null } | null>(null);
  const [asks, setAsks] = useState(0);
  const reload = useCallback(() => setAsks((n) => n + 1), []);
  // asked again when the screen comes back to the front: a pee, its time or the walk itself may have been changed
  // in its detail meanwhile
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  const asked = useRef(0);
  useEffect(() => {
    if (!api) return;
    const n = ++asked.current;
    const call = /^\d+$/.test(idOrKey) ? api.walk({ id: Number(idOrKey) }) : api.walkByKey({ key: idOrKey });
    call.then(
      // an answer like the one shown keeps its identity (the map isn't drawn anew)
      (data) => n === asked.current && setAnswer((a) => (a?.for === idOrKey && a.error === null && JSON.stringify(a.data) === JSON.stringify(data) ? a : { for: idOrKey, data, error: null })),
      (e) => n === asked.current && setAnswer((a) => ({ for: idOrKey, data: a?.for === idOrKey ? a.data : null, error: errorMessage(e) })),
    );
  }, [api, idOrKey, unsent, online, asks]);

  const ended = loadEnded(idOrKey);
  const local = ended ? fromEnded(ended, tapsOf(pending)) : null;
  const waiting = !!ended && pending.some((c) => c.at >= ended.startedAt && c.at <= ended.endedAt);
  const server = answer?.for === idOrKey ? answer : null;
  const done = server?.data && server.data.summary.endedAt !== null ? server.data : null;
  const replaced = !!ended && !!done && !waiting;
  // once the server's summary has replaced the copy kept at Zuhause, the copy goes
  useEffect(() => {
    if (replaced) clearEnded();
  }, [replaced]);
  if (done && !waiting) return { shown: fromServer(done.summary), track: done.track, local: false, error: null, reload };
  if (local) return { shown: local, track: null, local: true, error: null, reload };
  if (server?.data) return { shown: fromServer(server.data.summary), track: server.data.track, local: false, error: null, reload };
  return { shown: null, track: null, local: false, error: server?.error ?? null, reload };
}
