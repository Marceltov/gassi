// How a training on a walk reads in the walk's list and its summary: "Training · 4 Min. · Sitz 4/5 · 3 Leckerli",
// with the training screen's parts (@gassi/domain), and the walk's taps and trainings in one list by time.
import { formatMinutes, trainingParts } from "@gassi/domain";
import type { Tap, WalkSummary } from "./taps";

type Training = WalkSummary["trainings"][number];

export function trainingLine(t: Training): string {
  const treats = t.treats.reduce((n, x) => n + x.count, 0);
  return ["Training", formatMinutes(t.min), ...trainingParts(t.exercises, treats)].join(" · ");
}

/** The walk's pee/poop taps and its trainings, oldest first. */
export type WalkItem = { kind: "tap"; at: string; tap: Tap } | { kind: "training"; at: string; training: Training };

export function walkItems(taps: readonly Tap[], trainings: readonly Training[]): WalkItem[] {
  const items: WalkItem[] = [...taps.map((tap) => ({ kind: "tap" as const, at: tap.at, tap })), ...trainings.map((training) => ({ kind: "training" as const, at: training.startedAt, training }))];
  return items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
