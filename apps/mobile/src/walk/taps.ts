// The pee and poop of one walk as the walk screen and its summary list them: what the server counted, with this
// phone's taps it hasn't heard back about, each once. Which taps belong to the walk is decided by time, as on the
// server (ADR 0002). Before the server knows a just-ended walk, its summary is made from what the walk screen showed
// at "Zuhause" (`Ended`), with the same helpers the server uses.
import type { Output } from "@gassi/api-client";
import { type Command, minutesBetween, type Person, pausedWithin, type WalkView } from "@gassi/domain";

export type WalkSummary = Output<"walk">["summary"];
export type Tap = { type: "pee" | "poop"; at: string; dogId: number };

const same = (a: Tap, b: Tap) => a.type === b.type && a.at === b.at && a.dogId === b.dogId;
const byTime = (a: Tap, b: Tap) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

/** The pee/poop taps among `commands`. */
export const tapsOf = (commands: readonly Command[]): Tap[] => commands.flatMap((c) => (c.kind === "log" ? [{ type: c.type, at: c.at, dogId: c.dogId }] : []));

/** The pee/poop a summary from the server counted. */
export const summaryTaps = (s: Pick<WalkSummary, "pees" | "poops">): Tap[] => [
  ...s.pees.map((m) => ({ type: "pee" as const, ...m })),
  ...s.poops.map((m) => ({ type: "poop" as const, ...m })),
];

/** `known` with the `unsent` taps between `from` and `to` (null: the walk still runs) added, oldest first, each once. */
export function mergeTaps(known: readonly Tap[], unsent: readonly Tap[], from: string, to: string | null): Tap[] {
  const all = [...known];
  for (const t of unsent) if (t.at >= from && (to === null || t.at <= to) && !all.some((k) => same(k, t))) all.push(t);
  return all.sort(byTime);
}

/** Whether `taps` holds `tap`. */
export const holds = (taps: readonly Tap[], tap: Tap): boolean => taps.some((t) => same(t, tap));

/** A walk as it was when this phone tapped "Zuhause". */
export type Ended = { key: string; startedAt: string; endedAt: string; pauses: WalkView["pauses"]; walkers: Person[]; dogIds: number[]; taps: Tap[] };

/** What the summary screen shows; `id` is null while the server doesn't know the walk. */
export type Shown = Pick<WalkSummary, "startedAt" | "endedAt" | "totalMin" | "pauseMin" | "walkers" | "trainings" | "note"> & { id: number | null; taps: Tap[] };

export const fromServer = (s: WalkSummary): Shown => ({ ...s, taps: summaryTaps(s) });

export function fromEnded(e: Ended, unsent: readonly Tap[]): Shown {
  return {
    id: null,
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    totalMin: minutesBetween(e.startedAt, e.endedAt) ?? 0,
    pauseMin: Math.round(pausedWithin(e.pauses, e.startedAt, e.endedAt) / 60_000),
    walkers: e.walkers,
    trainings: [],
    note: null,
    taps: mergeTaps(e.taps, unsent, e.startedAt, e.endedAt),
  };
}
