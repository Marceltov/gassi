// Recording the running walk's route on this phone (#104, ADR 0014): positions as they come, kept on the device first
// (kept.ts, so a reload, a closed app or no reception loses nothing) and sent in batches with a sequence number. A
// batch, once made, is sent again as it is until the server has it: the server stores each (track, seq) once, so a
// batch that grew between tries would lose its new points. One track id per phone and walk; a reload goes on with it.
// Only one tab records (a Web Lock where the browser has one); the others wait for it to let go.
import { createLiveFilter, newId, type TrackPoint } from "@gassi/domain";
import { loadKept, saveKept } from "../data/kept";
import { watchPosition } from "./geo";

export type Batch = { trackId: string; walkKey: string; source: "phone"; seq: number; points: TrackPoint[] };
export type Geo = { watch(onPoint: (p: TrackPoint) => void, onDenied: () => void): () => void };
export type Locks = { request(name: string, fn: () => Promise<void>): Promise<void> };
export type RecordingStatus = "on" | "noSignal" | "denied";

const BATCH_MS = 30_000;
const NO_FIX_MS = 30_000;
const TICK_MS = 5_000; // how often the screen hears of the time passing (for "kein GPS-Signal")
const MAX_POINTS = 2000; // per batch, as the contract allows

type Recording = { trackId: string; points: TrackPoint[]; sent: number; nextSeq: number; inflight: { seq: number; to: number } | null; ended: boolean };
const KEY = "recordings";
const all = (): Record<string, Recording> => (loadKept(KEY) as Record<string, Recording> | null) ?? {};
const save = (walkKey: string, r: Recording | null) => {
  const rest = all();
  if (r) rest[walkKey] = r;
  else delete rest[walkKey];
  saveKept(KEY, rest);
};

// Sends what `walkKey`'s recording has not sent yet, batch by batch, until done or a send fails; drops a recording
// that is ended and sent. One at a time per page.
const sending = new Set<string>();
async function flush(walkKey: string, upload: (b: Batch) => Promise<unknown>): Promise<void> {
  if (sending.has(walkKey)) return;
  sending.add(walkKey);
  try {
    for (;;) {
      let r = all()[walkKey];
      if (!r) return;
      if (!r.inflight) {
        if (r.sent >= r.points.length) {
          if (r.ended) save(walkKey, null);
          return;
        }
        r = { ...r, inflight: { seq: r.nextSeq, to: Math.min(r.points.length, r.sent + MAX_POINTS) } };
        save(walkKey, r);
      }
      const { seq, to } = r.inflight!;
      try {
        await upload({ trackId: r.trackId, walkKey, source: "phone", seq, points: r.points.slice(r.sent, to) });
      } catch {
        return; // no reception, or the server is away: the batch waits as it is
      }
      const now = all()[walkKey] ?? r;
      save(walkKey, { ...now, sent: to, nextSeq: seq + 1, inflight: null });
    }
  } finally {
    sending.delete(walkKey);
  }
}

/** Sends what recordings of ended walks still hold (one that couldn't go out at Zuhause), and goes on with any other. */
export async function sendLeftovers(upload: (b: Batch) => Promise<unknown>): Promise<void> {
  for (const walkKey of Object.keys(all())) await flush(walkKey, upload);
}

const browserLocks = (): Locks | null => (typeof navigator !== "undefined" && "locks" in navigator ? (navigator.locks as unknown as Locks) : null);

/** Records `walkKey`'s route from now: `stop` at the walk's end (sends the rest), `close` when this page stops
 * recording without the walk ending (another phone took over, the screen goes away). */
export function createRecorder({ walkKey, upload, geo = { watch: watchPosition }, locks = browserLocks() }: { walkKey: string; upload: (b: Batch) => Promise<unknown>; geo?: Geo; locks?: Locks | null }) {
  const kept = all()[walkKey];
  if (!kept) save(walkKey, { trackId: newId(), points: [], sent: 0, nextSeq: 0, inflight: null, ended: false });
  const live = createLiveFilter();
  for (const p of kept?.points ?? []) live.add(p);
  let lastFix = Date.now();
  let denied = false;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());

  let unwatch: (() => void) | null = null;
  let release: (() => void) | null = null;
  let closed = false;
  const begin = () => {
    unwatch = geo.watch(
      (p) => {
        const r = all()[walkKey];
        if (!r || r.points.at(-1)?.t === p.t) return;
        save(walkKey, { ...r, points: [...r.points, p] });
        live.add(p);
        [lastFix, denied] = [Date.now(), false];
        changed();
      },
      () => {
        denied = true;
        changed();
      },
    );
  };
  if (locks)
    void locks.request(`gassi.recording.${walkKey}`, () => {
      if (closed) return Promise.resolve();
      begin();
      return new Promise<void>((let_go) => (release = let_go));
    });
  else begin();

  const batches = setInterval(() => void flush(walkKey, upload), BATCH_MS);
  const ticks = setInterval(changed, TICK_MS);
  const close = () => {
    closed = true;
    clearInterval(batches);
    clearInterval(ticks);
    unwatch?.();
    unwatch = null;
    release?.();
    release = null;
  };

  return {
    close,
    async stop() {
      close();
      const r = all()[walkKey];
      if (r) save(walkKey, { ...r, ended: true });
      await flush(walkKey, upload);
    },
    status: (): RecordingStatus => (denied ? "denied" : Date.now() - lastFix > NO_FIX_MS ? "noSignal" : "on"),
    distanceM: () => live.distanceM(),
    points: () => live.points(),
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;
