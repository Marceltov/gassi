"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { IconTrash, IconX } from "@tabler/icons-react";
import { deleteEntry, editEntry, logEntry } from "@/app/actions";
import type { EntryView } from "@/backend";
import { type EntryType, TYPE_LABEL } from "@/shared/entryTypes";
import { localToUtc, utcToLocal } from "@/shared/time";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";

/** What the sheet is for: a new entry of a type, or an existing one to change or delete. */
export type SheetTarget = { kind: "new"; type: EntryType } | { kind: "edit"; entry: EntryView };

type Props = {
  target: SheetTarget;
  timeZone: string;
  onClose: () => void;
  onLogged: (entry: EntryView) => void;
  onSaved: (entry: EntryView) => void;
  onDeleted: (entry: EntryView) => void;
};

type Fields = { at: string; durationMin: string; amountG: string; note: string };

function initialFields(target: SheetTarget, timeZone: string): Fields {
  if (target.kind === "new") return { at: utcToLocal(Date.now(), timeZone), durationMin: "", amountG: "", note: "" };
  const e = target.entry;
  return { at: utcToLocal(Date.parse(e.at), timeZone), durationMin: e.durationMin?.toString() ?? "", amountG: e.amountG?.toString() ?? "", note: e.note ?? "" };
}

const toInput = (f: Fields, timeZone: string) => ({ at: new Date(localToUtc(f.at, timeZone)).toISOString(), durationMin: f.durationMin, amountG: f.amountG, note: f.note });

// A bottom sheet with time (default now), duration (walks), amount in grams (food) and note; for an existing entry
// also "Löschen", which asks once more.
export function EntrySheet({ target, timeZone, onClose, onLogged, onSaved, onDeleted }: Props) {
  const type = target.kind === "new" ? target.type : target.entry.type;
  const [fields, setFields] = useState(() => initialFields(target, timeZone));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const Icon = TYPE_ICON[type];

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (name: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [name]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fields.at) return setError("Die Zeit fehlt.");
    startTransition(async () => {
      const input = toInput(fields, timeZone);
      if (target.kind === "new") {
        const r = await logEntry({ ...input, type });
        return r.ok ? onLogged(r.value) : setError(r.error);
      }
      const r = await editEntry(target.entry.id, input);
      return r.ok ? onSaved(r.value) : setError(r.error);
    });
  }

  function remove() {
    if (target.kind !== "edit") return;
    startTransition(async () => {
      const r = await deleteEntry(target.entry.id);
      return r.ok ? onDeleted(target.entry) : setError(r.error);
    });
  }

  const title = `${TYPE_LABEL[type]} ${target.kind === "new" ? "eintragen" : "bearbeiten"}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sheet-title" className="sheet-in relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none" style={{ "--c": TYPE_COLOR[type] } as React.CSSProperties}>
        <header className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-(--c) text-surface">
            <Icon size={24} stroke={2} aria-hidden />
          </span>
          <h2 id="sheet-title" className="flex-1 text-xl font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="flex size-12 items-center justify-center rounded-full text-muted">
            <IconX size={26} aria-hidden />
          </button>
        </header>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <Field label="Zeit">
            <input type="datetime-local" required value={fields.at} onChange={set("at")} className={input} />
          </Field>
          {type === "walk" && (
            <Field label="Dauer (Min.)">
              <input type="number" inputMode="numeric" min={1} max={1440} value={fields.durationMin} onChange={set("durationMin")} className={input} />
            </Field>
          )}
          {type === "food" && (
            <Field label="Menge (g)">
              <input type="number" inputMode="numeric" min={1} max={10000} value={fields.amountG} onChange={set("amountG")} className={input} />
            </Field>
          )}
          <Field label="Notiz">
            <textarea rows={2} maxLength={1000} value={fields.note} onChange={set("note")} className={`${input} py-3`} />
          </Field>

          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="min-h-14 rounded-2xl bg-primary text-lg font-bold text-primary-ink disabled:opacity-60">
            {target.kind === "new" ? "Eintragen" : "Speichern"}
          </button>
          {target.kind === "edit" && <DeleteButton confirming={confirmDelete} pending={pending} onAsk={() => setConfirmDelete(true)} onCancel={() => setConfirmDelete(false)} onConfirm={remove} />}
        </form>
      </div>
    </div>
  );
}

const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function DeleteButton({ confirming, pending, onAsk, onCancel, onConfirm }: { confirming: boolean; pending: boolean; onAsk: () => void; onCancel: () => void; onConfirm: () => void }) {
  const base = "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-bold";
  if (!confirming)
    return (
      <button type="button" onClick={onAsk} className={`${base} text-danger`}>
        <IconTrash size={22} aria-hidden /> Löschen
      </button>
    );
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onCancel} className={`${base} border border-line`}>
        Abbrechen
      </button>
      <button type="button" disabled={pending} onClick={onConfirm} className={`${base} bg-danger text-surface disabled:opacity-60`}>
        Wirklich löschen
      </button>
    </div>
  );
}
