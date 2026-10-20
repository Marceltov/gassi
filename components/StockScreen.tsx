"use client";

import { type FormEvent, useCallback, useState, useTransition } from "react";
import { correctStock, logRestock } from "@/app/actions";
import type { Stock } from "@/backend";
import { FOOD_KINDS, FOOD_LABEL, type FoodKind } from "@/shared/entryTypes";
import { formatCans, formatWeight, parseDecimal } from "@/shared/food";
import type { Result } from "@/shared/result";
import { TYPE_COLOR } from "./entryStyle";
import { Toast, type ToastMessage } from "./Toast";

const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink";

// /vorrat: what is left of each food and how long it lasts, what was bought, and the count corrected by hand.
export function StockScreen({ stock }: { stock: Stock }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const say = (text: string) => setToast({ id: Date.now(), text });
  return (
    <>
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Vorrat</h1>
        <p className="text-muted">Was noch da ist und wie lange es reicht.</p>
      </header>
      <div className="grid gap-3" style={{ "--c": TYPE_COLOR.food } as React.CSSProperties}>
        <KindCard kind="wet" main={stock.wet.cans !== null ? `noch ${formatCans(stock.wet.cans)}` : stock.wet.grams !== null ? `noch ${formatWeight(stock.wet.grams)}` : null} grams={stock.wet.grams} daysLeft={stock.wet.daysLeft} belowZero={stock.wet.belowZero} />
        <KindCard kind="dry" main={stock.dry.grams !== null ? `noch ${formatWeight(stock.dry.grams)}` : null} grams={null} daysLeft={stock.dry.daysLeft} belowZero={stock.dry.belowZero} />
      </div>
      <Restock canSizeG={stock.wet.canSizeG} onDone={() => say("Einkauf eingetragen")} />
      <Correct onDone={() => say("Bestand gespeichert")} />
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}

function KindCard({ kind, main, grams, daysLeft, belowZero }: { kind: FoodKind; main: string | null; grams: number | null; daysLeft: number | null; belowZero: boolean }) {
  const id = `stock-${kind}`;
  const details = [grams !== null && main?.includes("Dose") ? formatWeight(grams) : "", daysLeft !== null ? `reicht noch etwa ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : ""].filter(Boolean);
  return (
    <section aria-labelledby={id} className="rounded-3xl border-2 border-(--c)/35 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] p-4">
      <h2 id={id} className="font-bold text-muted">
        {FOOD_LABEL[kind]}
      </h2>
      <p className="text-3xl font-extrabold">{main ?? "kein Vorrat erfasst"}</p>
      {details.length > 0 && <p className="text-lg text-muted">{details.join(" · ")}</p>}
      {belowZero && <p className="mt-1 font-semibold text-danger">Laut Rechnung ist nichts mehr da. Bitte den Bestand korrigieren.</p>}
      {!main && <p className="mt-1 text-muted">Trag unten ein, was ihr gekauft habt.</p>}
    </section>
  );
}

function KindChoice({ name, kind, onChange }: { name: string; kind: FoodKind; onChange: (k: FoodKind) => void }) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="sr-only">Futterart</legend>
      {FOOD_KINDS.map((k) => (
        <label key={k} className={`relative flex min-h-12 items-center justify-center rounded-xl border-2 text-lg font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${kind === k ? "border-primary bg-primary/15" : "border-line"}`}>
          <input type="radio" name={name} value={k} checked={kind === k} onChange={() => onChange(k)} className="absolute inset-0 cursor-pointer appearance-none opacity-0" />
          {FOOD_LABEL[k]}
        </label>
      ))}
    </fieldset>
  );
}

function useSubmit(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (act: () => Promise<Result<unknown>>, reset: () => void) =>
    startTransition(async () => {
      const r = await act();
      if (!r.ok) return setError(r.error);
      setError(null);
      reset();
      onDone();
    });
  return { error, pending, submit };
}

function Form({ id, title, children, error, pending, submitLabel, onSubmit }: { id: string; title: string; children: React.ReactNode; error: string | null; pending: boolean; submitLabel: string; onSubmit: () => void }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="mb-2 text-xl font-bold">
        {title}
      </h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        {children}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="min-h-14 rounded-2xl bg-primary text-lg font-bold text-primary-ink disabled:opacity-60">
          {submitLabel}
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function Restock({ canSizeG, onDone }: { canSizeG: number | null; onDone: () => void }) {
  const [kind, setKind] = useState<FoodKind>("wet");
  const [cans, setCans] = useState("");
  const [unitG, setUnitG] = useState(canSizeG?.toString() ?? "");
  const [kg, setKg] = useState("");
  const { error, pending, submit } = useSubmit(onDone);
  const send = () =>
    submit(
      async () => {
        if (kind === "wet") return logRestock({ foodKind: "wet", cans, unitG });
        const n = parseDecimal(kg);
        return Number.isFinite(n) ? logRestock({ foodKind: "dry", grams: Math.round(n * 1000) }) : { ok: false, error: "Wie viel Kilo habt ihr gekauft?" };
      },
      () => {
        setCans("");
        setKg("");
      },
    );
  return (
    <Form id="restock" title="Eingekauft" error={error} pending={pending} submitLabel="Eintragen" onSubmit={send}>
      <KindChoice name="restock-kind" kind={kind} onChange={setKind} />
      {kind === "wet" ? (
        <div className="flex gap-3">
          <Field label="Dosen">
            <input type="number" inputMode="numeric" min={1} value={cans} onChange={(e) => setCans(e.target.value)} placeholder="12" className={input} />
          </Field>
          <Field label="Gramm pro Dose">
            <input type="number" inputMode="numeric" min={1} value={unitG} onChange={(e) => setUnitG(e.target.value)} placeholder="400" className={input} />
          </Field>
        </div>
      ) : (
        <Field label="Menge (kg)">
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="10" className={input} />
        </Field>
      )}
    </Form>
  );
}

function Correct({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<FoodKind>("wet");
  const [value, setValue] = useState("");
  const { error, pending, submit } = useSubmit(onDone);
  const send = () =>
    submit(
      async () => {
        const n = parseDecimal(value);
        if (!Number.isFinite(n)) return { ok: false, error: kind === "wet" ? "Wie viele Dosen sind noch da?" : "Wie viel Kilo sind noch da?" };
        return correctStock(kind === "wet" ? { foodKind: "wet", cans: n } : { foodKind: "dry", grams: Math.round(n * 1000) });
      },
      () => setValue(""),
    );
  return (
    <Form id="correct" title="Bestand korrigieren" error={error} pending={pending} submitLabel="Speichern" onSubmit={send}>
      <KindChoice name="correct-kind" kind={kind} onChange={setKind} />
      <Field label={kind === "wet" ? "Dosen jetzt" : "kg jetzt"}>
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "wet" ? "z. B. 5 oder 7,5" : "z. B. 3,5"} className={input} />
      </Field>
    </Form>
  );
}
