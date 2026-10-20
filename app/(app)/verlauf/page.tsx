import type { Metadata } from "next";
import { diary } from "@/backend";
import { HistoryFilters } from "@/components/HistoryFilters";
import { HistoryScreen } from "@/components/HistoryScreen";

export const metadata: Metadata = { title: "Verlauf" };
export const dynamic = "force-dynamic";

export default async function History({ searchParams }: PageProps<"/verlauf">) {
  const d = await diary();
  const filter = d.filter(await searchParams);
  const first = await d.history(filter);
  return (
    <>
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Verlauf</h1>
        <p className="text-muted">Alles, was mit {d.dogName} war, das Neueste zuerst.</p>
      </header>
      <HistoryFilters filter={filter} people={d.people()} />
      {/* A new filter starts the list afresh. */}
      <HistoryScreen key={`${filter.type ?? ""}:${filter.by ?? ""}`} filter={filter} first={first} timeZone={d.timeZone} now={new Date().toISOString()} />
    </>
  );
}
