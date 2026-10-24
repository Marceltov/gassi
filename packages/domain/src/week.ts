// The week (Monday to Sunday in the time zone) as the Woche page shows it: per day the walks and trainings as bars in
// minutes since local midnight (clipped to the day, so a walk across midnight is a bar on both days), food, pee and
// poop as ticks; above that the week's sums. A walk counts fully (walk, minutes, km) for each of its walkers, so the
// per-person sums can add up to more than the total; feedings and trainings count for whoever logged them (trainings
// have no walkers). A walk or training still running counts up to now.
import type { Entry } from "./entry";
import { isPractice } from "./entryTypes";
import { addCounts, type Counts, type ExerciseTotal, NO_COUNTS, repsOf } from "./exerciseTotals";
import { dayBounds, dayOf } from "./time";

type Names = ReadonlyMap<string, string>;

export type Bar = { type: "walk" | "training"; startMin: number; endMin: number };
export type Tick = { type: "food" | "pee" | "poop"; min: number };
export type WeekDay = { date: string; bars: Bar[]; ticks: Tick[]; walkMin: number; trainingMin: number };
export type Route = [lat: number, lon: number][];
export type PersonWeek = { id: string; name: string; walks: number; walkMin: number; km: number; feedings: number; trainings: number; trainingMin: number } & Counts;
export type WeekView = {
  monday: string;
  days: WeekDay[];
  byPerson: PersonWeek[];
  exercises: ExerciseTotal[];
  routes: { walkId: number; route: Route }[];
  treats: number;
};

export type WeekInput = {
  entries: readonly Entry[];
  walkers: Record<number, string[]>; // walk entry id → person ids
  trainings: Record<number, { exercises: ExerciseTotal[]; treats: number }>; // training entry id → what was practised
  tracks: Record<number, { distanceM: number; route: Route }>; // walk entry id → its shown track
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

export function weekView({ entries, walkers, trainings, tracks, names, monday, timeZone, now }: WeekInput): WeekView {
  const people = new Map<string, PersonWeek>();
  const person = (id: string) => {
    if (!people.has(id)) people.set(id, { id, name: names.get(id) ?? id, walks: 0, walkMin: 0, km: 0, feedings: 0, trainings: 0, trainingMin: 0, ...NO_COUNTS });
    return people.get(id)!;
  };
  const exercises = new Map<string, ExerciseTotal>();
  const routes: WeekView["routes"] = [];
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
    const at = Date.parse(e.at);
    const startsInWeek = at >= week.start && at < week.end;
    if (e.type === "food") {
      if (startsInWeek) person(e.loggedBy).feedings++;
      continue;
    }
    if (e.type !== "walk" && !isPractice(e.type)) continue;
    const until = e.endedAt ? Date.parse(e.endedAt) : e.clientKey ? now : at;
    const min = minutes(Math.max(0, Math.min(until, week.end) - Math.max(at, week.start)));
    if (e.type === "walk") {
      if (min === 0 && !startsInWeek) continue;
      const track = tracks[e.id];
      for (const u of walkers[e.id]?.length ? walkers[e.id] : [e.loggedBy]) {
        const p = person(u);
        p.walks++;
        p.walkMin += min;
        p.km += (track?.distanceM ?? 0) / 1000;
      }
      if (track) routes.push({ walkId: e.id, route: track.route });
    } else {
      if (!startsInWeek) continue;
      const p = person(e.loggedBy);
      // a command or treat without a training (#36) counts in the exercises and treats, not as a training
      if (e.type === "training") {
        p.trainings++;
        p.trainingMin += min;
      }
      const t = trainings[e.id];
      for (const x of t?.exercises ?? []) {
        const total = exercises.get(x.name) ?? { name: x.name, ...NO_COUNTS };
        exercises.set(x.name, { name: x.name, ...addCounts(total, x) });
        p.ok += x.ok;
        p.meh += x.meh;
        p.fail += x.fail;
      }
      treats += t?.treats ?? 0;
    }
  }

  return {
    monday,
    days,
    byPerson: [...people.values()].map((p) => ({ ...p, km: Math.round(p.km * 100) / 100 })).sort((a, b) => a.name.localeCompare(b.name, "de")),
    exercises: [...exercises.values()].sort((a, b) => repsOf(b) - repsOf(a) || a.name.localeCompare(b.name, "de")),
    routes,
    treats,
  };
}

/** The week starting `monday` for a heading: "19.–25. Okt.", "28. Okt.–3. Nov.", across New Year with the year. */
export function weekLabel(monday: string): string {
  const [from, to] = [monday, addDays(monday, 6)].map((d) => new Date(`${d}T12:00:00Z`));
  const part = (d: Date, withYear: boolean) => d.toLocaleDateString("de-DE", { day: "numeric", month: "short", timeZone: "UTC", ...(withYear ? { year: "numeric" } : {}) });
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  const crossYear = from.getUTCFullYear() !== to.getUTCFullYear();
  const start = sameMonth ? `${from.getUTCDate()}.` : part(from, crossYear);
  return `${start}–${part(to, crossYear)}`;
}
