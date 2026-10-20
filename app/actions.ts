"use server";
// The server actions behind the screens. Each checks the session itself (the proxy only guards page loads), calls
// one use case and refreshes the screens that show entries.
import { revalidatePath } from "next/cache";
import { diary, type EntryView, InputError } from "@/backend";
import { requireUser } from "@/app/_lib/session";
import type { Result } from "@/shared/result";

async function run<T>(act: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await act();
    revalidatePath("/");
    revalidatePath("/verlauf");
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
