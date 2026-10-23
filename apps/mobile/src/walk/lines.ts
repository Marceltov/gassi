// How a training on a walk reads in the walk's list and its summary: "Training · 4 Min. · Sitz 4/5 · 3 Leckerli",
// with the training screen's parts (@gassi/domain); the walk's taps and trainings in one list by time, and how many of
// each: "2× Pipi · 5× markiert · 1× Poopoo · 1 Training".
import { CONSISTENCY_LABEL, encounterLine, formatMinutes, trainingParts, TYPE_LABEL } from "@gassi/domain";
import type { Tap, WalkSummary } from "./taps";

type Training = WalkSummary["trainings"][number];

export function trainingLine(t: Training): string {
  const treats = t.treats.reduce((n, x) => n + x.count, 0);
  return ["Training", formatMinutes(t.min), ...trainingParts(t.exercises, treats)].join(" · ");
}

/** A tap in the walk's list: "Poopoo · weich", "Hundebegegnung · 2 fiept · nah", "Notiz · Matsch am Bach", with the
 * dog's name when several dogs walk ("Pipi · Toffee"). */
export function tapLine(tap: Tap, dogName: string | null): string {
  const details = tap.details ? encounterLine(tap.details) : "";
  const consistency = tap.consistency ? CONSISTENCY_LABEL[tap.consistency] : "";
  return [TYPE_LABEL[tap.type], consistency, details, tap.type === "note" ? (tap.note ?? "") : "", dogName ?? ""].filter(Boolean).join(" · ");
}

/** How many pees, markings, poops and trainings a walk had, the ones it had: "2× Pipi · 5× markiert · 1× Poopoo ·
 * 1 Training"; "Noch nichts". */
export function countLine(taps: readonly Tap[], trainings: readonly Training[]): string {
  const count = (type: Tap["type"]) => taps.filter((t) => t.type === type).length;
  const [pees, marks, poops] = [count("pee"), count("mark"), count("poop")];
  const encounters = taps.filter((t) => t.type === "dogEncounter" || t.type === "personEncounter").length;
  const parts = [pees ? `${pees}× Pipi` : "", marks ? `${marks}× markiert` : "", poops ? `${poops}× Poopoo` : "", encounters ? `${encounters} ${encounters === 1 ? "Begegnung" : "Begegnungen"}` : "", trainings.length ? `${trainings.length} ${trainings.length === 1 ? "Training" : "Trainings"}` : ""];
  return parts.filter(Boolean).join(" · ") || "Noch nichts";
}

/** The walk's pee/marking/poop taps and its trainings, oldest first. */
export type WalkItem = { kind: "tap"; at: string; tap: Tap } | { kind: "training"; at: string; training: Training };

export function walkItems(taps: readonly Tap[], trainings: readonly Training[]): WalkItem[] {
  const items: WalkItem[] = [...taps.map((tap) => ({ kind: "tap" as const, at: tap.at, tap })), ...trainings.map((training) => ({ kind: "training" as const, at: training.startedAt, training }))];
  return items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
