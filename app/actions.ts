"use server";
// The server actions behind the screens. Each checks the session itself (the proxy only guards page loads), calls
// one use case and refreshes the screens that show entries.
import { revalidatePath } from "next/cache";
import { catalog, diary, type EntryView, type Exercise, type HistoryPage, InputError, type TreatKind } from "@/backend";
import { requireUser } from "@/app/_lib/session";
import type { Result } from "@/shared/result";

async function run<T>(act: () => Promise<T>, paths = ["/", "/verlauf", "/vorrat", "/woche"]): Promise<Result<T>> {
  try {
    const value = await act();
    for (const p of paths) revalidatePath(p);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: e.message };
    throw e;
  }
}

const missing = () => {
  throw new InputError("Diesen Eintrag gibt es nicht mehr.");
};

/** `input`: type, at (ISO) and the optional durationMin, amountG and note. */
export async function logEntry(input: unknown): Promise<Result<EntryView>> {
  const user = await requireUser();
  return run(async () => (await diary()).log(user, input));
}

export async function editEntry(id: number, input: unknown): Promise<Result<EntryView>> {
  await requireUser();
  return run(async () => (await (await diary()).edit(id, input)) ?? missing());
}

export async function deleteEntry(id: number): Promise<Result<null>> {
  await requireUser();
  return run(async () => ((await (await diary()).remove(id)) ? null : missing()));
}

/** Bought food: `{ foodKind: "wet", cans, unitG }` or `{ foodKind: "dry", grams }`. */
export async function logRestock(input: unknown): Promise<Result<EntryView>> {
  const user = await requireUser();
  return run(async () => (await diary()).restock(user, input));
}

/** What is there now: `{ foodKind: "wet", cans }` or `{ foodKind: "dry", grams }`. */
export async function correctStock(input: unknown): Promise<Result<EntryView>> {
  const user = await requireUser();
  return run(async () => (await diary()).correctStock(user, input));
}

/** `{ kg, at }`: Toffee's weight, kg as "12,4" or 12.4. */
export async function logWeight(input: unknown): Promise<Result<EntryView>> {
  const user = await requireUser();
  return run(async () => (await diary()).logWeight(user, input), ["/gewicht", "/verlauf"]);
}

/** The next page of the history ("Mehr laden"); `filter` is checked like the page's search params. */
export async function loadHistory(filter: { type?: unknown; by?: unknown; day?: unknown }, offset: number): Promise<HistoryPage> {
  await requireUser();
  const d = await diary();
  return d.history(d.filter(filter), Math.max(0, Math.trunc(offset) || 0));
}

// The household's lists (Einstellungen). Trainings show them too, so those screens refresh as well.
const CATALOG_PATHS = ["/einstellungen", "/training"];

export async function addExercise(name: unknown): Promise<Result<Exercise>> {
  await requireUser();
  return run(async () => (await catalog()).addExercise(name), CATALOG_PATHS);
}

export async function renameExercise(id: number, name: unknown): Promise<Result<null>> {
  await requireUser();
  return run(async () => ((await (await catalog()).renameExercise(id, name)), null), CATALOG_PATHS);
}

export async function archiveExercise(id: number): Promise<Result<null>> {
  await requireUser();
  return run(async () => ((await (await catalog()).archiveExercise(id)), null), CATALOG_PATHS);
}

export async function addTreatKind(input: unknown): Promise<Result<TreatKind>> {
  await requireUser();
  return run(async () => (await catalog()).addTreatKind(input), CATALOG_PATHS);
}

export async function updateTreatKind(id: number, input: unknown): Promise<Result<null>> {
  await requireUser();
  return run(async () => ((await (await catalog()).updateTreatKind(id, input)), null), CATALOG_PATHS);
}

export async function archiveTreatKind(id: number): Promise<Result<null>> {
  await requireUser();
  return run(async () => ((await (await catalog()).archiveTreatKind(id)), null), CATALOG_PATHS);
}
