import Link from "next/link";
import type { WeekView } from "@/backend";
import { formatMinutes } from "@/shared/time";
import { TYPE_COLOR } from "./entryStyle";

const DAY = 24 * 60;
const pct = (min: number) => `${(Math.min(min, DAY) / DAY) * 100}%`;
const heading = (date: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(Date.parse(`${date}T12:00:00Z`));

// One row per day from 0 to 24 h: walks and trainings as bars in their real length, food, pee and poop as ticks.
// Each row opens that day in the Verlauf.
export function WeekStrips({ week }: { week: WeekView }) {
  return (
    <section aria-labelledby="week-strips" className="mt-6">
      <h2 id="week-strips" className="mb-2 text-xl font-bold">
        Tag für Tag
      </h2>
      <div className="mb-1 ml-12 flex justify-between text-xs text-muted" aria-hidden>
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {week.days.map((d) => {
          const summary = [d.walkMin ? `${formatMinutes(d.walkMin)} Gassi` : "", d.trainingMin ? `${formatMinutes(d.trainingMin)} Training` : ""].filter(Boolean).join(", ") || "nichts";
          return (
            <li key={d.date}>
              <Link href={`/verlauf?day=${d.date}`} aria-label={`${heading(d.date)}: ${summary}`} className="flex min-h-12 items-center gap-2 rounded-xl active:bg-line/40">
                <span className="w-10 shrink-0 text-right font-bold text-muted">{heading(d.date).slice(0, 2)}</span>
                <span className="relative h-10 flex-1 overflow-hidden rounded-lg border border-line bg-surface">
                  {[6, 12, 18].map((h) => (
                    <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h * 60) }} />
                  ))}
                  {d.bars.map((b, i) => (
                    <span key={i} data-testid={`bar-${b.type}`} className="absolute top-1.5 bottom-1.5 min-w-1 rounded" style={{ left: pct(b.startMin), width: `max(0.25rem, ${pct(b.endMin - b.startMin)})`, background: TYPE_COLOR[b.type] }} />
                  ))}
                  {d.ticks.map((t, i) => (
                    <span key={i} className="absolute bottom-0 h-3 w-0.5 rounded-full" style={{ left: pct(t.min), background: TYPE_COLOR[t.type] }} />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
