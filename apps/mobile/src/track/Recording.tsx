// The running walk's route for every screen (#104, ADR 0014): while a walk runs and this device is its recorder, a
// recorder (recorder.ts) runs here, whichever tab is open; it stops at the walk's end (sending the rest) and lets go
// when another phone takes over; with "Bildschirm auf der Runde anlassen" on, it keeps the screen on meanwhile.
// useRecording() gives the walk screen what it shows: whether this phone records, how recording goes, the distance and
// route so far, who records, and `takeOver`. `sent` counts the batches that reached the server, so the summary asks
// again once the last one is there. A gap without positions (a tunnel, or Android ended the service) doesn't end the
// recording: it goes on when positions come again, and an opened app starts the service again (#108).
import { newId, type TrackPoint } from "@gassi/domain";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGassi } from "../data/GassiProvider";
import { recordingGeo, stopStaleBackground } from "./geo";
import { type Batch, createRecorder, type Recorder, type RecordingStatus, sendLeftovers, uploadWith } from "./recorder";
import { useScreenOn } from "./screenOn";
import { holdScreen } from "./wakeLock";
import { events } from "../data/events";

export type Recording = {
  mine: boolean;
  status: RecordingStatus;
  distanceM: number;
  points: TrackPoint[];
  recorderName: string | null;
  sent: number;
  takeOver(): void;
};

const RecordingContext = createContext<Recording | null>(null);

type Live = Pick<Recording, "status" | "distanceM" | "points">;
const NOTHING: Live = { status: "on", distanceM: 0, points: [] };

// The running recorder's numbers as an outside store for useSyncExternalStore: the same object until they change.
function liveStore() {
  let recorder: Recorder | null = null;
  let live = NOTHING;
  const listeners = new Set<() => void>();
  const changed = () => {
    const before = live.status;
    live = recorder ? { status: recorder.status(), distanceM: recorder.distanceM(), points: recorder.points() } : NOTHING;
    if (recorder && live.status !== before) events.record("track", "status", { status: live.status });
    listeners.forEach((fn) => fn());
  };
  return {
    set(r: Recorder | null) {
      recorder = r;
      changed();
      return r ? r.subscribe(changed) : () => {};
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    get: () => live,
  };
}

export function RecordingProvider({ children }: { children: ReactNode }) {
  const { view, device, api, send } = useGassi();
  const walk = view.walk;
  const key = walk?.key ?? null;
  const startedAt = walk?.startedAt ?? null;
  const mine = !!walk && !!device && walk.recorder?.deviceId === device.id;
  const store = useMemo(() => liveStore(), []);
  const live = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [sent, setSent] = useState(0);
  // the walk running after this render, for the recorder's cleanup to tell an ended walk from a handover (layout
  // effects run before the cleanups of the effects below)
  const running = useRef(key);
  useLayoutEffect(() => {
    running.current = key;
  }, [key]);

  const upload = useCallback(
    async (b: Batch) => {
      if (!api) throw new Error("signed out");
      const answer = await uploadWith(api)(b);
      setSent((n) => n + 1);
      return answer;
    },
    [api],
  );

  // Android: a service still recording a walk that ended or went to another phone while the app was closed stops
  useEffect(() => {
    if (device) void stopStaleBackground(key, mine);
  }, [device, key, mine]);

  // what an earlier page, a recording handed over or a Zuhause without reception left unsent
  useEffect(() => {
    if (api) void sendLeftovers(upload, key);
  }, [api, upload, key, mine]);

  useEffect(() => {
    if (!key || !startedAt || !mine || !api) return;
    const r = createRecorder({ walkKey: key, upload, geo: recordingGeo(startedAt) });
    const unsubscribe = store.set(r);
    return () => {
      unsubscribe();
      store.set(null);
      // the walk is over (or another one runs): send the rest; else another phone took over, or the page goes
      if (running.current !== key) void r.stop();
      else r.close();
    };
  }, [key, startedAt, mine, api, upload, store]);

  // "Bildschirm auf der Runde anlassen": the screen stays on while this phone records
  const screenOn = useScreenOn();
  useEffect(() => (key && mine && screenOn ? holdScreen() : undefined), [key, mine, screenOn]);

  const takeOver = useCallback(() => {
    if (key) send({ id: newId(), at: new Date().toISOString(), kind: "walk.record", walkKey: key });
  }, [key, send]);

  const value: Recording = {
    mine,
    ...(mine ? live : NOTHING),
    recorderName: walk?.recorder?.name ?? null,
    sent,
    takeOver,
  };
  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording(): Recording {
  const r = useContext(RecordingContext);
  if (!r) throw new Error("useRecording needs the RecordingProvider (app/_layout.tsx)");
  return r;
}
