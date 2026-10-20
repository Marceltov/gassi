"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editEntry } from "@/app/actions";
import type { WalkSummary as Summary } from "@/backend";
import { clockTime } from "@/shared/time";
import { PendingHint } from "./PendingHint";
import { walkerNames } from "./useSessions";

// After Zuhause: what the walk was, and a note for it. Until the stop has reached the server there is nothing to sum
// up yet; the page reloads when it has.
export function WalkSummary({ summary, timeZone, pending }: { summary: Summary | null; timeZone: string; pending: number }) {
  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-4">
      <h1 id="summary-title" className="text-3xl font-extrabold tracking-tight">
        Runde beendet
      </h1>
      {summary ? <Details summary={summary} timeZone={timeZone} /> : <p className="text-lg text-muted">Die Zusammenfassung kommt, sobald alles gesendet ist.</p>}
      <PendingHint count={pending} />
      <Link href="/" replace className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-ink">
        Fertig
      </Link>
    </section>
  );
}

function Details({ summary: s, timeZone }: { summary: Summary; timeZone: string }) {
  const treats = s.trainings.reduce((n, t) => n + t.treats.reduce((m, x) => m + x.count, 0), 0);
  const range = `${clockTime(Date.parse(s.startedAt), timeZone)}–${s.endedAt ? clockTime(Date.parse(s.endedAt), timeZone) : "jetzt"}`;
  return (
    <>
      <div className="rounded-3xl border border-line bg-surface p-5">
        <p className="text-5xl font-extrabold tabular-nums">
          {s.totalMin} Min.
          {s.pauseCount > 0 && (
            <span className="mt-1 block text-xl font-bold text-muted">
              <span className="sr-only">, </span>davon {s.pauseMin} Min. Pause
            </span>
          )}
        </p>
        <p className="mt-1 text-lg text-muted">
          {range} · {walkerNames(s.walkers)}
        </p>
        <ul className="mt-4 flex flex-wrap gap-2 text-lg">
          <li className="rounded-full bg-pee/20 px-3 py-1 font-bold">Pipi {s.pee}×</li>
          <li className="rounded-full bg-poop/20 px-3 py-1 font-bold">Poopoo {s.poop}×</li>
          {treats > 0 && <li className="rounded-full bg-training/20 px-3 py-1 font-bold">{treats} Leckerlis</li>}
        </ul>
      </div>
      {s.trainings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {s.trainings.map((t, i) => (
            <li key={i} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <strong>Training, {t.min} Min.</strong>
              {t.exercises.length > 0 && <span>: {t.exercises.join(", ")}</span>}
              {t.treats.length > 0 && <span className="block text-muted">{t.treats.map((x) => `${x.name} ${x.count}×`).join(", ")}</span>}
            </li>
          ))}
        </ul>
      )}
      <Note id={s.id} startedAt={s.startedAt} endedAt={s.endedAt} note={s.note} />
    </>
  );
}

function Note({ id, startedAt, endedAt, note }: { id: number; startedAt: string; endedAt: string | null; note: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing)
    return (
      <div>
        {note && <p className="mb-2 text-lg break-words">{note}</p>}
        <button type="button" onClick={() => setEditing(true)} className="min-h-12 w-full rounded-2xl border border-line font-bold">
          {note ? "Notiz ändern" : "Notiz hinzufügen"}
        </button>
      </div>
    );

  const save = () =>
    startTransition(async () => {
      const r = await editEntry(id, { at: startedAt, endedAt, note: text });
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted">Notiz</span>
        <textarea autoFocus rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-3 text-lg text-ink" />
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button type="button" disabled={pending} onClick={save} className="min-h-12 rounded-2xl bg-primary font-bold text-primary-ink disabled:opacity-60">
        Speichern
      </button>
    </div>
  );
}
