// The week (Monday to Sunday in the time zone) as the Woche page shows it: per day the walks and trainings as bars in
// minutes since local midnight (clipped to the day, so a walk across midnight is a bar on both days), food, pee and
// poop as ticks; above that the week's sums. A walk counts for each of its walkers, so the per-person sums can add up
// to more than the total. A walk or training still running counts up to now.
import { dayBounds, dayOf } from "@gassi/domain";
import type { Entry } from "./entries/model";
import type { Names } from "./people";

export type Bar = { type: "walk" | "training"; startMin: number; endMin: number };
export type Tick = { type: "food" | "pee" | "poop"; min: number };
export type WeekDay = { date: string; bars: Bar[]; ticks: Tick[]; walkMin: number; trainingMin: number };
export type PersonMinutes = { username: string; name: string; min: number };
export type WeekView = {
  monday: string;
  days: WeekDay[];
  walkMinByPerson: PersonMinutes[];
  trainingMinByPerson: PersonMinutes[];
  exerciseCounts: { name: string; count: number }[];
  treats: number;
};

export type WeekInput = {
  entries: readonly Entry[];
  walkers: Record<number, string[]>; // walk entry id → usernames
  trainings: Record<number, { exercises: string[]; treats: number }>; // training entry id → what was practised
  names: Names;
  monday: string; // "2026-10-19"
  timeZone: string;
  now: number;
};

/** "2026-10-19" + n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week `ms` falls in, in `timeZone`. */
export function mondayOf(ms: number, timeZone: string): string {
  const day = dayOf(ms, timeZone);
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

/** Where the week starting `monday` begins and the next one begins, as UTC instants. */
export function weekBounds(monday: string, timeZone: string): { start: number; end: number } {
  const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);
  return { start: dayBounds(noon(monday), timeZone).start, end: dayBounds(noon(addDays(monday, 7)), timeZone).start };
}

const minutes = (ms: number) => Math.round(ms / 60_000);

function byPerson(totals: Map<string, number>, names: Names): PersonMinutes[] {
  return [...totals]
    .map(([username, min]) => ({ username, name: names.get(username) ?? username, min }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function weekView({ entries, walkers, trainings, names, monday, timeZone, now }: WeekInput): WeekView {
  const walkTotals = new Map<string, number>();
  const trainingTotals = new Map<string, number>();
  const exercises = new Map<string, number>();
  let treats = 0;
  const week = weekBounds(monday, timeZone);

  const days = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = addDays(monday, i);
    const { start, end } = dayBounds(Date.parse(`${date}T12:00:00Z`), timeZone);
    const day: WeekDay = { date, bars: [], ticks: [], walkMin: 0, trainingMin: 0 };
    for (const e of entries) {
      const at = Date.parse(e.at);
      if (e.type === "walk" || e.type === "training") {
        const until = e.endedAt ? Date.parse(e.endedAt) : e.clientKey ? now : at;
        const [from, to] = [Math.max(at, start), Math.min(until, end)];
        if (to <= from) continue;
        day.bars.push({ type: e.type, startMin: minutes(from - start), endMin: minutes(to - start) });
        if (e.type === "walk") day.walkMin += minutes(to - from);
        else day.trainingMin += minutes(to - from);
      } else if ((e.type === "food" || e.type === "pee" || e.type === "poop") && at >= start && at < end) {
        day.ticks.push({ type: e.type, min: minutes(at - start) });
      }
    }
    day.bars.sort((a, b) => a.startMin - b.startMin);
    day.ticks.sort((a, b) => a.min - b.min);
    return day;
  });

  for (const e of entries) {
    if (e.type !== "walk" && e.type !== "training") continue;
    const at = Date.parse(e.at);
    const until = e.endedAt ? Date.parse(e.endedAt) : e.clientKey ? now : at;
    const min = minutes(Math.max(0, Math.min(until, week.end) - Math.max(at, week.start)));
    if (e.type === "walk") {
      if (min === 0 && !(at >= week.start && at < week.end)) continue;
      for (const u of walkers[e.id]?.length ? walkers[e.id] : [e.loggedBy]) walkTotals.set(u, (walkTotals.get(u) ?? 0) + min);
    } else {
      if (!(at >= week.start && at < week.end)) continue;
      trainingTotals.set(e.loggedBy, (trainingTotals.get(e.loggedBy) ?? 0) + min);
      const t = trainings[e.id];
      for (const name of t?.exercises ?? []) exercises.set(name, (exercises.get(name) ?? 0) + 1);
      treats += t?.treats ?? 0;
    }
  }

  return {
    monday,
    days,
    walkMinByPerson: byPerson(walkTotals, names),
    trainingMinByPerson: byPerson(trainingTotals, names),
    exerciseCounts: [...exercises].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de")),
    treats,
  };
}
