"use client";

import { useCallback, useState } from "react";
import { deleteEntry } from "@/app/actions";
import type { EntryView } from "@/backend";
import { type EntryType, TYPE_LABEL } from "@/shared/entryTypes";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { Toast, type ToastMessage } from "./Toast";

export type EntryChange = { kind: "logged" | "saved" | "deleted"; entry: EntryView };

// The entry sheet and the toast a screen shows, with the messages every change gets: "Gassi eingetragen" with
// "Rückgängig" for 5 s, "Gespeichert", "Gelöscht". `onChange` hears about every change, the undo included.
export function useEntrySheet(timeZone: string, onChange?: (change: EntryChange) => void) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const show = useCallback((text: string, action?: ToastMessage["action"]) => setToast({ id: Date.now(), text, action }), []);
  const dismiss = useCallback(() => setToast(null), []);
  const close = useCallback(() => setTarget(null), []);

  const undo = useCallback(
    async (entry: EntryView) => {
      setToast(null);
      const r = await deleteEntry(entry.id);
      if (!r.ok) return show(r.error);
      onChange?.({ kind: "deleted", entry });
    },
    [onChange, show],
  );

  const logged = useCallback(
    (entry: EntryView) => {
      setTarget(null);
      show(`${TYPE_LABEL[entry.type]} eingetragen`, { label: "Rückgängig", run: () => void undo(entry) });
      onChange?.({ kind: "logged", entry });
    },
    [onChange, show, undo],
  );

  const done = (kind: "saved" | "deleted", text: string) => (entry: EntryView) => {
    setTarget(null);
    show(text);
    onChange?.({ kind, entry });
  };

  const ui = (
    <>
      {target && <EntrySheet target={target} timeZone={timeZone} onClose={close} onLogged={logged} onSaved={done("saved", "Gespeichert")} onDeleted={done("deleted", "Gelöscht")} />}
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );

  return {
    openNew: (type: EntryType) => setTarget({ kind: "new", type }),
    openEdit: (entry: EntryView) => setTarget({ kind: "edit", entry }),
    logged,
    show,
    ui,
  };
}
