"use client";

import { type FormEvent, useState, useTransition } from "react";
import { logWeight } from "@/app/actions";
import { localToUtc, utcToLocal } from "@/shared/time";

const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-lg text-ink";

// "Gewicht (kg)" and when, default now. The page shows the new value and curve after saving.
export function WeightForm({ timeZone }: { timeZone: string }) {
  const [kg, setKg] = useState("");
  const [at, setAt] = useState(() => utcToLocal(Date.now(), timeZone));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await logWeight({ kg, at: new Date(localToUtc(at, timeZone)).toISOString() });
      if (!r.ok) return setError(r.error);
      setError(null);
      setKg("");
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted">Gewicht (kg)</span>
        <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="z. B. 12,4" className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted">Zeit</span>
        <input type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} className={input} />
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
  );
}
