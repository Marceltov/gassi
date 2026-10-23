// The pee, markings and poop of one walk as the walk screen and its summary list them: what the server counted, with this
// phone's taps it hasn't heard back about, each once. Which taps belong to the walk is decided by time, as on the
// server (ADR 0002). Before the server knows a just-ended walk, its summary is made from what the walk screen showed
// at "Zuhause" (`Ended`), with the same helpers the server uses.
import type { Output } from "@gassi/api-client";
import { type Command, type Consistency, type EntryDetails, minutesBetween, type Person, pausedWithin, type WalkView, withinWalk } from "@gassi/domain";

export type WalkSummary = Output<"walk">["summary"];
/** A pee, marking or poop, or a note or encounter logged on the walk; `id` is its entry's once the server has it (a tap
 * still in the queue has none); a poop may have a consistency, a note or encounter its text and details. A note is for
 * no dog. */
export type Tap = { type: "pee" | "mark" | "poop" | "note" | "dogEncounter" | "personEncounter"; at: string; dogId: number | null; id?: number; consistency?: Consistency | null; note?: string | null; details?: EntryDetails | null };

const same = (a: Tap, b: Tap) => a.type === b.type && a.at === b.at && a.dogId === b.dogId;
const byTime = (a: Tap, b: Tap) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

/** The pee/marking/poop taps and the notes and encounters among `commands`. */
export const tapsOf = (commands: readonly Command[]): Tap[] =>
  commands.flatMap((c): Tap[] => {
    if (c.kind === "log") return [{ type: c.type, at: c.at, dogId: c.dogId }];
    if (c.kind === "log.entry") return [{ type: c.type, at: c.at, dogId: c.dogId ?? null, note: c.note ?? null, details: c.details ?? null }];
    return [];
  });

/** `taps` with the consistencies among `commands` (not yet answered by the server) laid over their poops, the last one
 * tapped winning. */
export function withConsistencies(taps: readonly Tap[], commands: readonly Command[]): Tap[] {
  return taps.map((t) => {
    const set = commands.filter((c) => c.kind === "log.consistency" && t.type === "poop" && c.poopAt === t.at && c.dogId === t.dogId).at(-1);
    return set?.kind === "log.consistency" ? { ...t, consistency: set.consistency } : t;
  });
}

/** The pee, markings, poop, notes and encounters a summary from the server holds. */
export const summaryTaps = (s: Pick<WalkSummary, "pees" | "marks" | "poops" | "logged">): Tap[] => [
  ...s.logged,
  ...s.pees.map((m) => ({ type: "pee" as const, ...m })),
  ...s.marks.map((m) => ({ type: "mark" as const, ...m })),
  ...s.poops.map((m) => ({ type: "poop" as const, ...m })),
];

/** `known` with the `unsent` taps during the walk from `from` to `to` (null: it still runs) added, oldest first, each
 * once. */
export function mergeTaps(known: readonly Tap[], unsent: readonly Tap[], from: string, to: string | null): Tap[] {
  const all = [...known];
  for (const t of unsent) if (withinWalk(t.at, from, to) && !all.some((k) => same(k, t))) all.push(t);
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
