"use client";

import { type FormEvent, useState, useTransition } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { addExercise, addTreatKind, archiveExercise, archiveTreatKind, renameExercise, updateTreatKind } from "@/app/actions";
import type { Exercise, TreatKind } from "@/backend";
import type { Result } from "@/shared/result";

// The two lists on Einstellungen: exercises (add, rename, remove) and treat kinds (add, change, remove). Every change
// is a server action; the page reloads its lists after each one.

const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink";
const primary = "flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-ink disabled:opacity-60";
const iconButton = "flex size-12 shrink-0 items-center justify-center rounded-full text-muted";

/** "0,5" or "0.5" → 0.5; anything else → NaN (the server says what is wrong). */
export const parseDecimal = (v: string) => Number(v.trim().replace(",", "."));
const formatGrams = (g: number) => `${g.toLocaleString("de-DE", { maximumFractionDigits: 1 })} g`;

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<Result<unknown>>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setError(null);
      after?.();
    });
  return { error, pending, act };
}

function Section({ id, title, children, error }: { id: string; title: string; children: React.ReactNode; error: string | null }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-2 text-xl font-bold">
        {title}
      </h2>
      {children}
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

export function ExerciseEditor({ exercises }: { exercises: Exercise[] }) {
  const { error, pending, act } = useAction();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    act(() => addExercise(name), () => setName(""));
  };

  return (
    <Section id="exercises" title="Übungen" error={error}>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {exercises.length === 0 && <li className="px-4 py-3 text-muted">Noch keine Übungen.</li>}
        {exercises.map((ex) =>
          editing === ex.id ? (
            <li key={ex.id} className="p-3">
              <RenameForm name={ex.name} pending={pending} onCancel={() => setEditing(null)} onSave={(n) => act(() => renameExercise(ex.id, n), () => setEditing(null))} />
            </li>
          ) : (
            <li key={ex.id} className="flex min-h-14 items-center gap-1 pl-4">
              <span className="flex-1 text-lg">{ex.name}</span>
              <button type="button" className={iconButton} aria-label={`${ex.name} umbenennen`} onClick={() => setEditing(ex.id)}>
                <IconPencil size={22} aria-hidden />
              </button>
              <button type="button" className={iconButton} aria-label={`${ex.name} entfernen`} disabled={pending} onClick={() => act(() => archiveExercise(ex.id))}>
                <IconTrash size={22} aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Neue Übung</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="z. B. Rückruf" className={input} />
        </label>
        <button type="submit" disabled={pending || !name.trim()} className={primary}>
          <IconPlus size={20} aria-hidden /> Hinzufügen
        </button>
      </form>
    </Section>
  );
}

function RenameForm({ name, pending, onSave, onCancel }: { name: string; pending: boolean; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
      className="flex flex-col gap-2"
    >
      <label>
        <span className="sr-only">Neuer Name für {name}</span>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} className={input} />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-xl border border-line font-bold">
          Abbrechen
        </button>
        <button type="submit" disabled={pending} className={`${primary} flex-1`}>
          Speichern
        </button>
      </div>
    </form>
  );
}

type TreatFields = { name: string; grams: string; fromDry: boolean };

const toTreatInput = (f: TreatFields) => ({ name: f.name, gramsPerPiece: parseDecimal(f.grams), fromDry: f.fromDry });

export function TreatKindEditor({ treatKinds }: { treatKinds: TreatKind[] }) {
  const { error, pending, act } = useAction();
  const [editing, setEditing] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <Section id="treats" title="Leckerlis" error={error}>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {treatKinds.length === 0 && <li className="px-4 py-3 text-muted">Noch keine Leckerlis.</li>}
        {treatKinds.map((t) =>
          editing === t.id ? (
            <li key={t.id} className="p-3">
              <TreatForm
                initial={{ name: t.name, grams: String(t.gramsPerPiece).replace(".", ","), fromDry: t.fromDry }}
                labelPrefix={`${t.name}: `}
                submitLabel="Speichern"
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(f) => act(() => updateTreatKind(t.id, toTreatInput(f)), () => setEditing(null))}
              />
            </li>
          ) : (
            <li key={t.id} className="flex min-h-16 items-center gap-1 py-2 pl-4">
              <span className="flex-1">
                <span className="block text-lg">{t.name}</span>
                <span className="block text-muted">
                  {formatGrams(t.gramsPerPiece)} · {t.fromDry ? "aus dem Trockenfutter" : "extra"}
                </span>
              </span>
              <button type="button" className={iconButton} aria-label={`${t.name} ändern`} onClick={() => setEditing(t.id)}>
                <IconPencil size={22} aria-hidden />
              </button>
              <button type="button" className={iconButton} aria-label={`${t.name} entfernen`} disabled={pending} onClick={() => act(() => archiveTreatKind(t.id))}>
                <IconTrash size={22} aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
        <TreatForm
          key={formKey}
          initial={{ name: "", grams: "", fromDry: true }}
          labelPrefix=""
          newLabel="Neues Leckerli"
          submitLabel="Hinzufügen"
          pending={pending}
          onSubmit={(f) => act(() => addTreatKind(toTreatInput(f)), () => setFormKey((k) => k + 1))}
        />
      </div>
    </Section>
  );
}

type TreatFormProps = {
  initial: TreatFields;
  labelPrefix: string;
  newLabel?: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (f: TreatFields) => void;
  onCancel?: () => void;
};

function TreatForm({ initial, labelPrefix, newLabel, submitLabel, pending, onSubmit, onCancel }: TreatFormProps) {
  const [f, setF] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted">{newLabel ?? `${labelPrefix}Name`}</span>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} placeholder="z. B. Käsewürfel" className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted">{labelPrefix}Gramm pro Stück</span>
        <input inputMode="decimal" value={f.grams} onChange={(e) => setF({ ...f, grams: e.target.value })} placeholder="z. B. 0,5" className={input} />
      </label>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" checked={f.fromDry} onChange={(e) => setF({ ...f, fromDry: e.target.checked })} className="size-6 accent-(--primary)" />
        <span className="text-lg">
          {labelPrefix}
          aus dem Trockenfutter
        </span>
      </label>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-xl border border-line font-bold">
            Abbrechen
          </button>
        )}
        <button type="submit" disabled={pending || !f.name.trim()} className={`${primary} flex-1`}>
          {submitLabel === "Hinzufügen" && <IconPlus size={20} aria-hidden />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
