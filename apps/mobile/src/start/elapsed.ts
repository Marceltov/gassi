// How long a running walk has been going: since its start, minus the pauses.
import { formatElapsed, pausedWithin, type WalkView } from "@gassi/domain";

export function walkClock(walk: WalkView, nowMs: number): string {
  const now = new Date(nowMs).toISOString();
  return formatElapsed(nowMs - Date.parse(walk.startedAt) - pausedWithin(walk.pauses, walk.startedAt, now));
}
