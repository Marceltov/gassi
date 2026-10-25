// Recording the running walk's route on this phone (#104, ADR 0014): positions as they come, kept on the device first
// (kept.ts, so a reload, a closed app or no reception loses nothing) and sent in batches with a sequence number. A
// batch, once made, is sent again as it is until the server has it: the server stores each (track, seq) once, so a
// batch that grew between tries would lose its new points. One track id per phone and walk; a reload goes on with it.
// Only one tab records (a Web Lock where the browser has one); the others wait for it to let go, and meanwhile show its
// route from what it keeps. A batch the server
// refuses for good (its walk's start never reached it) is tried again while the walk runs, and given up once it is over.
// On Android the points come from a task that also runs without a screen (headless.ts, #108): it keeps and sends them
// through `keepPoint` and `sendRecording`, and an open screen reads what it kept.
import { ApiError, type Client, trackPointSchema } from "@gassi/api-client";
import { createLiveFilter, newId, type TrackPoint } from "@gassi/domain";
import { loadKept, saveKept } from "../data/kept";
import { type Events, events } from "../data/events";
import { batchEvent } from "../data/usage";

export type Batch = { trackId: string; walkKey: string; source: "phone"; seq: number; points: TrackPoint[] };
/** `watch` returns the stop of this page's watching; `end` ends recording on this device at the walk's end (Android's
 * background service, which outlives the page). */
export type Geo = { watch(walkKey: string, onPoint: (p: TrackPoint) => void, onDenied: () => void): () => void; end?(): Promise<void> };
export type Locks = { request(name: string, fn: () => Promise<void>): Promise<void> };
export type RecordingStatus = "on" | "noSignal" | "denied";

/** What `upload` throws when the server refuses a batch for good (400: "Diese Runde gibt es nicht."). */
export class RejectedBatch extends Error {}

/** The upload through `api`, a refusal for good as RejectedBatch; answers whether this device still records. */
export const uploadWith =
  (api: Client, stream: Events = events) =>
  async (b: Batch): Promise<{ recording: boolean }> => {
    try {
      const answer = await api.uploadTrack(b);
      const { name, data } = batchEvent(b.points.length, answer);
      stream.record("track", name, data);
      return answer;
    } catch (e) {
      const { name, data } = batchEvent(b.points.length, null);
      stream.record("track", name, data);
      throw e instanceof ApiError && e.status === 400 ? new RejectedBatch() : e;
    }
  };

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

/** Keeps `p` in `walkKey`'s recording; false when there is none, `p` repeats the last point's time, or the contract
 * refuses it (a laptop's accuracy of kilometres would hold up every batch after it). */
export function keepPoint(walkKey: string, p: TrackPoint): boolean {
  const r = all()[walkKey];
  // in time order: the same time again, or an older one delivered late, is dropped
  const last = r?.points.at(-1);
  if (!r || (last && Date.parse(p.t) <= Date.parse(last.t)) || !trackPointSchema.safeParse(p).success) return false;
  save(walkKey, { ...r, points: [...r.points, p] });
  return true;
}

/** Whether a recording of `walkKey` is kept and not over. */
export const hasRecording = (walkKey: string): boolean => all()[walkKey]?.ended === false;

/** The kept points of `walkKey`'s recording. */
export const keptPoints = (walkKey: string): TrackPoint[] => all()[walkKey]?.points ?? [];

/** Marks `walkKey`'s recording as over: once the rest is sent, it is forgotten. */
export function endRecording(walkKey: string): void {
  const r = all()[walkKey];
  if (r) save(walkKey, { ...r, ended: true });
}

/** Sends what `walkKey`'s recording has not sent yet, batch by batch, until done or a send fails; drops a recording
 * that is ended and sent. One at a time per process. Returns the last answer of the server, if a batch went out and
 * nothing failed after it. */
const sending = new Set<string>();
export async function sendRecording(walkKey: string, upload: (b: Batch) => Promise<unknown>): Promise<unknown> {
  if (sending.has(walkKey)) return undefined;
  sending.add(walkKey);
  let answer: unknown;
  try {
    for (;;) {
      let r = all()[walkKey];
      if (!r) return answer;
      if (!r.inflight) {
        if (r.sent >= r.points.length) {
          if (r.ended) save(walkKey, null);
          return answer;
        }
        r = { ...r, inflight: { seq: r.nextSeq, to: Math.min(r.points.length, r.sent + MAX_POINTS) } };
        save(walkKey, r);
      }
      const { seq, to } = r.inflight!;
      try {
        answer = await upload({ trackId: r.trackId, walkKey, source: "phone", seq, points: r.points.slice(r.sent, to) });
      } catch (e) {
        // refused for good after the walk: nothing will take it, so the recording goes; else (no reception, the
        // server away, a start still queued) the batch waits as it is
        if (e instanceof RejectedBatch && all()[walkKey]?.ended) save(walkKey, null);
        return undefined;
      }
      // gone meanwhile (signed out, kept.ts): nothing to save back
      const now = all()[walkKey];
      if (!now) return answer;
      save(walkKey, { ...now, sent: to, nextSeq: seq + 1, inflight: null });
    }
  } finally {
    sending.delete(walkKey);
  }
}

/** Sends what recordings still hold: one that couldn't go out at Zuhause, one handed over to another phone, one an
 * earlier page left. A recording of a walk other than `running` (the walk running now, if any) is over: once sent, it
 * is forgotten. */
export async function sendLeftovers(upload: (b: Batch) => Promise<unknown>, running: string | null): Promise<void> {
  for (const [walkKey, r] of Object.entries(all())) {
    if (walkKey !== running && !r.ended) save(walkKey, { ...r, ended: true });
    await sendRecording(walkKey, upload);
  }
}

const browserLocks = (): Locks | null => (typeof navigator !== "undefined" && "locks" in navigator ? (navigator.locks as unknown as Locks) : null);

/** Records `walkKey`'s route from now: `stop` at the walk's end (sends the rest), `close` when this page stops
 * recording without the walk ending (another phone took over, the screen goes away). */
/** `geo`: where positions come from (geo.ts's `recordingGeo`). */
export function createRecorder({ walkKey, upload, geo, locks = browserLocks() }: { walkKey: string; upload: (b: Batch) => Promise<unknown>; geo: Geo; locks?: Locks | null }) {
  const kept = all()[walkKey];
  // a recording taken for over while this walk wasn't known yet (sendLeftovers) goes on
  save(walkKey, kept ? { ...kept, ended: false } : { trackId: newId(), points: [], sent: 0, nextSeq: 0, inflight: null, ended: false });
  const live = createLiveFilter();
  let fed = 0; // how many of the kept points the live filter has had
  let lastFix = Date.now();
  // the kept points the live filter hasn't had yet: on start, and while another tab records
  const catchUp = () => {
    const points = all()[walkKey]?.points ?? [];
    for (const p of points.slice(fed)) live.add(p);
    if (points.length > fed) lastFix = Math.max(lastFix, Date.parse(points.at(-1)!.t));
    fed = points.length;
  };
  catchUp();
  let denied = false;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());

  let unwatch: (() => void) | null = null;
  let release: (() => void) | null = null;
  let closed = false;
  const begin = () => {
    unwatch = geo.watch(
      walkKey,
      (p) => {
        // kept here (the web), or already by the background task (Android): either way the live filter has it once
        if (!keepPoint(walkKey, p) && all()[walkKey]?.points.at(-1)?.t !== p.t) return;
        catchUp();
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

  const batches = setInterval(() => void sendRecording(walkKey, upload), BATCH_MS);
  const ticks = setInterval(() => {
    if (!unwatch) catchUp(); // another tab records
    changed();
  }, TICK_MS);
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
      await geo.end?.();
      endRecording(walkKey);
      await sendRecording(walkKey, upload);
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
