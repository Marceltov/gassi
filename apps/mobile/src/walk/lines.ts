// How a training on a walk reads in the walk's list and its summary: "🎯 Training · 4 Min. · Sitz 4/5 · 3 Leckerlis".
import { formatMinutes } from "@gassi/domain";
import type { WalkSummary } from "./taps";

export function trainingLine(t: WalkSummary["trainings"][number]): string {
  const treats = t.treats.reduce((n, x) => n + x.count, 0);
  return [
    "🎯 Training",
    formatMinutes(t.min),
    ...t.exercises.map((x) => `${x.name} ${x.ok}/${x.ok + x.fail}`),
    ...(treats ? [`${treats} ${treats === 1 ? "Leckerli" : "Leckerlis"}`] : []),
  ].join(" · ");
}
