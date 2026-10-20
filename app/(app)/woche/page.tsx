import type { Metadata } from "next";
import Link from "next/link";
import { IconBuildingWarehouse, IconChevronLeft, IconChevronRight, IconScale } from "@tabler/icons-react";
import { addDays, diary } from "@/backend";
import { WeekStrips } from "@/components/WeekStrips";
import { WeekSums } from "@/components/WeekSums";

export const metadata: Metadata = { title: "Woche" };
export const dynamic = "force-dynamic";

const range = (monday: string) => {
  const f = (day: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", ...opts }).format(Date.parse(`${day}T12:00:00Z`));
  return `${f(monday, { day: "numeric", month: "long" })} – ${f(addDays(monday, 6), { day: "numeric", month: "long" })}`;
};

const arrow = "flex size-12 items-center justify-center rounded-full border border-line bg-surface";
const link = "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-lg font-bold";

export default async function Week({ searchParams }: PageProps<"/woche">) {
  const d = await diary();
  const week = await d.week((await searchParams).w);
  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Woche</h1>
          <p className="text-muted">{range(week.monday)}</p>
        </div>
        <Link href={`/woche?w=${addDays(week.monday, -7)}`} aria-label="Vorherige Woche" className={arrow}>
          <IconChevronLeft size={24} aria-hidden />
        </Link>
        <Link href={`/woche?w=${addDays(week.monday, 7)}`} aria-label="Nächste Woche" className={arrow}>
          <IconChevronRight size={24} aria-hidden />
        </Link>
      </header>
      <div className="mb-4 flex gap-3">
        <Link href="/gewicht" className={link}>
          <IconScale size={24} aria-hidden /> Gewicht
        </Link>
        <Link href="/vorrat" className={link}>
          <IconBuildingWarehouse size={24} aria-hidden /> Vorrat
        </Link>
      </div>
      <WeekSums week={week} />
      <WeekStrips week={week} />
    </>
  );
}
