"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { IconBuildingWarehouse, IconX } from "@tabler/icons-react";
import { logEntry } from "@/app/actions";
import type { EntryView } from "@/backend";
import { FOOD_KINDS, FOOD_LABEL, type FoodKind } from "@/shared/entryTypes";
import { TYPE_COLOR, TYPE_ICON } from "./entryStyle";

type Props = { lastFood: Record<FoodKind, number | null>; onClose: () => void; onLogged: (entry: EntryView) => void };

// The Futter tile's sheet: the usual portion of each kind as one big button (one tap logs it now), any other amount
// with its kind, and the way to the stock.
export function FoodSheet({ lastFood, onClose, onLogged }: Props) {
  const usual = FOOD_KINDS.filter((k) => lastFood[k]);
  const [kind, setKind] = useState<FoodKind>(usual[0] ?? "wet");
  const [grams, setGrams] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const Icon = TYPE_ICON.food;

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const log = (foodKind: FoodKind, amountG: number | string) =>
    startTransition(async () => {
      const r = await logEntry({ type: "food", foodKind, amountG, at: new Date().toISOString() });
      return r.ok ? onLogged(r.value) : setError(r.error);
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!grams.trim()) return setError("Wie viel Gramm?");
    log(kind, grams);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="food-title" className="sheet-in relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none" style={{ "--c": TYPE_COLOR.food } as React.CSSProperties}>
        <header className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-(--c) text-surface">
            <Icon size={24} stroke={2} aria-hidden />
          </span>
          <h2 id="food-title" className="flex-1 text-xl font-bold">
            Futter
          </h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="flex size-12 items-center justify-center rounded-full text-muted">
            <IconX size={26} aria-hidden />
          </button>
        </header>

        {usual.length > 0 && (
          <div className="mt-5 grid gap-3">
            {usual.map((k) => (
              <button key={k} type="button" disabled={pending} onClick={() => log(k, lastFood[k]!)} className="min-h-16 rounded-2xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] text-xl font-extrabold disabled:opacity-60">
                {FOOD_LABEL[k]} {lastFood[k]} g
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1.5 font-semibold text-muted">{usual.length > 0 ? "Andere Menge" : "Was und wie viel?"}</legend>
            {FOOD_KINDS.map((k) => (
              <label key={k} className={`relative flex min-h-12 items-center justify-center rounded-xl border-2 text-lg font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${kind === k ? "border-(--c) bg-(--c)/15" : "border-line"}`}>
                <input type="radio" name="foodKind" value={k} checked={kind === k} onChange={() => setKind(k)} className="absolute inset-0 cursor-pointer appearance-none opacity-0" />
                {FOOD_LABEL[k]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-muted">Menge (g)</span>
            <input type="number" inputMode="numeric" min={1} max={10000} value={grams} onChange={(e) => setGrams(e.target.value)} placeholder={lastFood[kind]?.toString()} className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink" />
          </label>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="min-h-14 rounded-2xl bg-primary text-lg font-bold text-primary-ink disabled:opacity-60">
            Eintragen
          </button>
        </form>
        <Link href="/vorrat" className="mt-3 flex min-h-12 items-center justify-center gap-2 font-semibold text-primary">
          <IconBuildingWarehouse size={22} aria-hidden /> Vorrat
        </Link>
      </div>
    </div>
  );
}
