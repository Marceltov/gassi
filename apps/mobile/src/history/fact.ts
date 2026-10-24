// What an entry's detail shows large on top, so the eye finds it first (#81): an opened can's size, a count's or a
// purchase's cans and grams, a pee's, marking's, poop's or encounter's time and dog, a training's minutes and what was trained. From the form,
// so it follows what is being changed (the − and + next to it, #81). Food, weight, a walk and a note show theirs themselves (the amount, the summary,
// the text).
import { clockTime, FOOD_LABEL, formatCans, formatMinutes, formatWeight, minutesBetween, trainingSummaryLine } from "@gassi/domain";
import type { Entry, Form } from "./form";

/** One value large with a line under it, or a row per can size with its cans and what they come to. */
export type Fact = { big: string; sub: string } | { rows: { label: string; value: string }[]; sum: string };

type Names = { dogName: (id: number) => string; exerciseName: (id: number) => string; timeZone: string };

export function factOf(entry: Entry, form: Form, names: Names): Fact | null {
  switch (entry.type) {
    case "opened":
      return { big: `${form.unitG} g`, sub: "eine Dose Nassfutter" };
    case "stockcheck":
      if (entry.count) {
        const rows = form.count.map((r) => ({ label: `Dosen à ${r.unitG} g`, value: String(r.cans) }));
        return { rows, sum: `zusammen ${formatWeight(form.count.reduce((g, r) => g + r.cans * r.unitG, 0))}` };
      }
      return { big: formatWeight(form.amountG ?? 0), sub: `${FOOD_LABEL.dry} gezählt` };
    case "restock":
      if (entry.unitG) return { big: formatCans(Math.round((form.amountG ?? 0) / entry.unitG)), sub: `à ${entry.unitG} g · ${formatWeight(form.amountG ?? 0)}` };
      return { big: formatWeight(form.amountG ?? 0), sub: `${FOOD_LABEL.dry} gekauft` };
    case "pee":
    case "mark":
    case "poop":
    case "dogEncounter":
    case "personEncounter":
    case "command":
    case "treat": {
      const ms = Date.parse(form.at);
      const day = new Intl.DateTimeFormat("de-DE", { timeZone: names.timeZone, weekday: "short", day: "2-digit", month: "2-digit" }).format(ms);
      return { big: clockTime(ms, names.timeZone), sub: `${form.dogIds.map(names.dogName).join(", ")} · ${day}` };
    }
    case "training": {
      const min = minutesBetween(form.at, form.endedAt);
      const rows = form.reps.filter((r) => form.dogIds.includes(r.dogId)).map((r) => ({ ...r, name: names.exerciseName(r.exerciseId) }));
      return { big: min === null ? "läuft" : formatMinutes(min), sub: trainingSummaryLine(rows, form.treats.reduce((n, t) => n + t.count, 0)) };
    }
    default:
      return null;
  }
}
