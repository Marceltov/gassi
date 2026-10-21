// How a training on a walk reads in the walk's list and its summary: "Training · 4 Min. · Sitz 4/5 · 3 Leckerli",
// with the training screen's parts (@gassi/domain).
import { formatMinutes, trainingParts } from "@gassi/domain";
import type { WalkSummary } from "./taps";

export function trainingLine(t: WalkSummary["trainings"][number]): string {
  const treats = t.treats.reduce((n, x) => n + x.count, 0);
  return ["Training", formatMinutes(t.min), ...trainingParts(t.exercises, treats)].join(" · ");
}
