import type { Metadata } from "next";
import { diary } from "@/backend";
import { formatKg } from "@/components/entryStyle";
import { WeightChart } from "@/components/WeightChart";
import { WeightForm } from "@/components/WeightForm";

export const metadata: Metadata = { title: "Gewicht" };
export const dynamic = "force-dynamic";

const dayMonth = (iso: string, timeZone: string) => new Intl.DateTimeFormat("de-DE", { timeZone, day: "numeric", month: "short" }).format(Date.parse(iso));

export default async function Weight() {
  const d = await diary();
  const weights = await d.all({ type: "weight" });
  const last = weights[0];
  const points = weights.map((w) => ({ at: Date.parse(w.at), kg: (w.amountG ?? 0) / 1000 }));
  return (
    <>
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Gewicht</h1>
        <p className="text-muted">{last ? `${formatKg(last.amountG ?? 0)} am ${dayMonth(last.at, d.timeZone)}` : `Noch kein Gewicht von ${d.dogName} eingetragen.`}</p>
      </header>
      <WeightChart points={points} />
      <WeightForm timeZone={d.timeZone} />
    </>
  );
}
