"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { IconCheck, IconMinus, IconPlus, IconTarget } from "@tabler/icons-react";
import { addExercise } from "@/app/actions";
import type { Exercise, SessionsView, TreatKind, User } from "@/backend";
import { clockTime, formatElapsed } from "@/shared/time";
import { TYPE_COLOR } from "./entryStyle";
import { PendingHint } from "./PendingHint";
import { useLiveRefresh } from "./useLiveRefresh";
import { useTicker } from "./useNow";
import { newId, useSessions } from "./useSessions";

type Props = { view: SessionsView; user: User; timeZone: string; exercises: Exercise[]; treatKinds: TreatKind[] };

// /training: one block with a running clock, the exercises practised (tapped, not timed), a "+1" per treat kind and
// "Training fertig", which goes back to the walk the training belongs to, or to Heute.
export function TrainingScreen({ view: initial, user, timeZone, exercises, treatKinds }: Props) {
  const router = useRouter();
  const { view, pending, push } = useSessions(initial, user);
  useLiveRefresh();
  const training = view.training;

  if (!training)
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Training</h1>
        <p className="text-muted">Gerade läuft kein Training.</p>
        <button type="button" onClick={() => void push({ kind: "training.start", trainingKey: newId(), ...(view.walk ? { walkKey: view.walk.key } : {}) })} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-ink">
          <IconTarget size={28} aria-hidden /> Training starten
        </button>
        <Link href={view.walk ? "/runde" : "/"} className="min-h-12 py-3 font-semibold text-muted">
          {view.walk ? "Zurück zur Runde" : "Zurück zu Heute"}
        </Link>
        <PendingHint count={pending} />
      </div>
    );

  const key = training.key;
  const done = () => void push({ kind: "training.stop", trainingKey: key }).then(() => router.push(training.walkKey ? "/runde" : "/"));

  return (
    <div className="flex flex-col gap-5" style={{ "--c": TYPE_COLOR.training } as React.CSSProperties}>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Training</h1>
        <p className="text-lg text-muted">{training.walkKey ? "auf der Runde" : "zu Hause"}</p>
      </header>
      <TrainingClock startedAt={training.startedAt} timeZone={timeZone} />

      <section aria-labelledby="training-exercises">
        <h2 id="training-exercises" className="mb-2 text-xl font-bold">
          Übungen
        </h2>
        <div className="flex flex-wrap gap-2">
          {exercises.map((ex) => {
            const on = training.exercises.includes(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                aria-pressed={on}
                onClick={() => void push({ kind: "training.exercise", trainingKey: key, exerciseId: ex.id, on: !on })}
                className={`flex min-h-12 items-center gap-1.5 rounded-full border-2 px-4 text-lg font-bold ${on ? "border-(--c) bg-(--c) text-surface" : "border-line bg-surface"}`}
              >
                {on && <IconCheck size={20} aria-hidden />}
                {ex.name}
              </button>
            );
          })}
          <AddExercise onAdded={(ex) => void push({ kind: "training.exercise", trainingKey: key, exerciseId: ex.id, on: true }).then(() => router.refresh())} />
        </div>
      </section>

      <section aria-labelledby="training-treats">
        <h2 id="training-treats" className="mb-2 text-xl font-bold">
          Leckerlis
        </h2>
        {treatKinds.length === 0 ? (
          <p className="text-muted">
            Noch keine Leckerlis.{" "}
            <Link href="/einstellungen" className="font-semibold text-primary underline">
              Leckerlis anlegen
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {treatKinds.map((t) => {
              const count = training.treats[t.id] ?? 0;
              return (
                <li key={t.id} role="group" aria-label={t.name} className="flex items-center gap-2 rounded-2xl border border-line bg-surface py-2 pr-2 pl-4">
                  <span className="flex-1 text-lg font-semibold">{t.name}</span>
                  <button type="button" aria-label={`−1 ${t.name}`} disabled={count === 0} onClick={() => void push({ kind: "training.treat", trainingKey: key, treatKindId: t.id, delta: -1 })} className="flex size-12 items-center justify-center rounded-full text-muted disabled:opacity-40">
                    <IconMinus size={22} aria-hidden />
                  </button>
                  <span className="w-10 text-center text-3xl font-extrabold tabular-nums">{count}</span>
                  <button type="button" aria-label={`+1 ${t.name}`} onClick={() => void push({ kind: "training.treat", trainingKey: key, treatKindId: t.id, delta: 1 })} className="flex min-h-14 min-w-20 items-center justify-center rounded-2xl bg-(--c) text-xl font-extrabold text-surface active:scale-[0.97]">
                    +1
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* always in reach, however long the lists above get */}
      <div className="sticky bottom-[calc(var(--chrome)+env(safe-area-inset-bottom))] -mx-4 bg-bg/95 px-4 pt-2 pb-3 backdrop-blur">
        <button type="button" onClick={done} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-ink">
          <IconCheck size={26} aria-hidden /> Training fertig
        </button>
        <PendingHint count={pending} />
      </div>
    </div>
  );
}

function TrainingClock({ startedAt, timeZone }: { startedAt: string; timeZone: string }) {
  const now = useTicker();
  const started = Date.parse(startedAt);
  return (
    <div className="rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] px-4 py-5 text-center">
      <p className="text-6xl font-extrabold tracking-tight tabular-nums" aria-label="Dauer des Trainings">
        {now === null ? "0:00" : formatElapsed(now - started)}
      </p>
      <p className="mt-1 text-lg text-muted">seit {clockTime(started, timeZone)}</p>
    </div>
  );
}

// "+ Übung": a new exercise on the spot, switched on for this training.
function AddExercise({ onAdded }: { onAdded: (ex: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 items-center gap-1 rounded-full border-2 border-dashed border-line px-4 text-lg font-bold text-muted">
        <IconPlus size={20} aria-hidden /> Übung
      </button>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await addExercise(name);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setName("");
      setError(null);
      onAdded(r.value);
    });
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Neue Übung</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="z. B. Bleib" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink" />
        </label>
        <button type="submit" disabled={pending || !name.trim()} className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-ink disabled:opacity-60">
          Hinzufügen
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
