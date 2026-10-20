import type { WeekView } from "@/backend";
import { formatMinutes } from "@/shared/time";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// The week's sums: walk and training time per person (a joint walk counts for each walker), how often each exercise
// was practised, treats, and a column per day with walk and training minutes stacked.
export function WeekSums({ week }: { week: WeekView }) {
  const max = Math.max(60, ...week.days.map((d) => d.walkMin + d.trainingMin));
  return (
    <section aria-labelledby="week-sums" className="rounded-3xl border border-line bg-surface p-4">
      <h2 id="week-sums" className="sr-only">
        Summen
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <PersonSums title="Gassi" color="var(--walk)" rows={week.walkMinByPerson} />
        <PersonSums title="Training" color="var(--training)" rows={week.trainingMinByPerson} />
      </div>
      {(week.exerciseCounts.length > 0 || week.treats > 0) && (
        <p className="mt-3 text-muted">
          {week.exerciseCounts.map((x) => `${x.name} ${x.count}×`).join(", ")}
          {week.exerciseCounts.length > 0 && week.treats > 0 && " · "}
          {week.treats > 0 && `${week.treats} Leckerlis`}
        </p>
      )}
      <div className="mt-4 grid h-28 grid-cols-7 items-end gap-2" aria-hidden>
        {week.days.map((d, i) => (
          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1">
            <div className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-md" style={{ height: `${((d.walkMin + d.trainingMin) / max) * 100}%` }}>
              <div className="bg-training" style={{ flexGrow: d.trainingMin }} />
              <div className="bg-walk" style={{ flexGrow: d.walkMin }} />
            </div>
            <span className="text-sm text-muted">{WEEKDAYS[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonSums({ title, color, rows }: { title: string; color: string; rows: WeekView["walkMinByPerson"] }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-bold">
        <span className="size-3 rounded-full" style={{ background: color }} aria-hidden /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-muted">nichts</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.username} className="flex justify-between gap-2">
              <span>{r.name}</span>
              <span className="font-bold tabular-nums">{formatMinutes(r.min)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
