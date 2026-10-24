// The Android recording without a screen (#108): positions arrive in a task (background.ts) that runs whether the app's
// screen is open, closed or gone. This is that task's logic, without Expo: it keeps each position in the walk's
// recording (recorder.ts), tells an open screen, and sends a batch every 30 s. The track upload's answer says whether
// this device still records; once it doesn't (the walk ended, another phone took the route), the task sends the rest
// and stops the service. Which walk it records is kept (`background`), so the task needs nothing but storage.
import { type Command, createLiveFilter, formatDistance, type TrackPoint } from "@gassi/domain";
import { loadKept, saveKept, dropKept } from "../data/kept";
import { storage } from "../data/storage";
import { hhmm } from "../time";
import { type Batch, endRecording, hasRecording, keepPoint, keptPoints, sendRecording } from "./recorder";

const BATCH_MS = 30_000;
const KEY = "background";

/** A position as expo-location delivers it. */
export type Location = { timestamp: number; coords: { latitude: number; longitude: number; altitude: number | null; accuracy: number | null } };
/** The walk this device records in the background, since when, and when it last sent. */
export type Background = { walkKey: string; startedAt: string; lastSentAt: number };
export type HeadlessDeps = {
  now(): number;
  upload(b: Batch): Promise<{ recording: boolean }>;
  stopService(): Promise<void>;
  /** whether a command for the walk still waits in the queue */
  queued(walkKey: string): boolean;
  /** an open screen hears of each kept point */
  onPoint(p: TrackPoint): void;
};

export function backgroundWalk(): Background | null {
  const b = loadKept(KEY) as Background | null;
  return b && typeof b.walkKey === "string" && typeof b.startedAt === "string" && typeof b.lastSentAt === "number" ? b : null;
}

/** Records `walkKey` in the background from now (the walk started at `startedAt`); the same walk again goes on. */
export function beginBackground(walkKey: string, startedAt: string): void {
  const b = backgroundWalk();
  saveKept(KEY, { walkKey, startedAt, lastSentAt: b?.walkKey === walkKey ? b.lastSentAt : Date.now() });
}

export const clearBackground = (): void => dropKept(KEY);

export const toPoint = ({ timestamp, coords }: Location): TrackPoint => ({ t: new Date(timestamp).toISOString(), lat: coords.latitude, lon: coords.longitude, ele: coords.altitude ?? null, acc: coords.accuracy ?? null });

/** Whether `personId`'s queue still holds a command for `walkKey`. */
export function queuedFor(personId: string, walkKey: string): boolean {
  try {
    const queue = JSON.parse(storage.getItem(`gassi.commands.${personId}`) ?? "[]") as Command[];
    return Array.isArray(queue) && queue.some((c) => "walkKey" in c && c.walkKey === walkKey);
  } catch {
    return false;
  }
}

/** The task's work for one delivery of positions. */
export async function onLocations(locations: Location[], deps: HeadlessDeps): Promise<void> {
  const b = backgroundWalk();
  if (!b || !hasRecording(b.walkKey)) {
    clearBackground();
    await deps.stopService();
    return;
  }
  for (const l of locations) {
    const p = toPoint(l);
    if (keepPoint(b.walkKey, p)) deps.onPoint(p);
  }
  const now = deps.now();
  if (now - b.lastSentAt < BATCH_MS) return;
  saveKept(KEY, { ...b, lastSentAt: now });
  const answer = (await sendRecording(b.walkKey, deps.upload)) as { recording: boolean } | undefined;
  if (answer?.recording !== false || deps.queued(b.walkKey)) return;
  endRecording(b.walkKey);
  await sendRecording(b.walkKey, deps.upload);
  clearBackground();
  await deps.stopService();
}

/** The distance recorded so far, filtered as the screen shows it. */
export function distanceOf(walkKey: string): number {
  const live = createLiveFilter();
  for (const p of keptPoints(walkKey)) live.add(p);
  return live.distanceM();
}

/** The notification's line under "Runde läuft": "Seit 14:05 · 1,2 km". */
export const notificationBody = (startedAt: string, distanceM: number): string => `Seit ${hhmm(startedAt)} · ${formatDistance(distanceM)}`;

/** An open screen listens here to the points the task keeps (geo.ts). */
const listeners = new Set<(p: TrackPoint) => void>();
export const pointEvents = {
  emit: (p: TrackPoint) => listeners.forEach((fn) => fn(p)),
  subscribe(fn: (p: TrackPoint) => void): () => void {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};
