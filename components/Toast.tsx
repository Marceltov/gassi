"use client";

import { useEffect } from "react";

export type ToastMessage = { id: number; text: string; action?: { label: string; run: () => void } };

export const TOAST_MS = 5000;

// One short message above the bottom bar, with at most one action ("Rückgängig"), gone after 5 s.
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink py-2 pr-2 pl-5 text-bg shadow-lg">
      <span className="font-semibold">{toast.text}</span>
      {toast.action && (
        <button type="button" onClick={toast.action.run} className="min-h-12 rounded-xl px-4 font-bold underline-offset-4 hover:underline">
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
