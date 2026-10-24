// What is usual on this phone for a command or a treat (#36, #98): the last command's exercise and whether it came with
// a treat, and the Leckerli on you (the kind given last, one for both). On a walk a tap logs the usual without a sheet;
// with only one kind there is, a treat never asks.
type Usual = { exerciseId?: number; treatKindId?: number | null; commandTreat?: boolean };
type Named = { id: number; name: string };

/** What a tap logs at once, without a sheet, or null when there is something to ask. */
export type Quick = { kind: "quick.treat"; treatKindId: number } | { kind: "quick.command"; exerciseId: number; ok: true; treatKindId?: number };

/** The usual exercise and Leckerli among the household's, and whether a command comes with one. */
export function usualOf(usual: Usual, exercises: readonly Named[], kinds: readonly Named[]): { exercise?: Named; treatKind?: Named; commandTreat: boolean } {
  return {
    exercise: exercises.find((e) => e.id === usual.exerciseId),
    treatKind: kinds.length === 1 ? kinds[0] : kinds.find((k) => k.id === usual.treatKindId),
    commandTreat: usual.commandTreat !== false,
  };
}

/** What a tap on Kommando or Leckerli logs at once: on a walk (`quick`) the usual, else a treat when there is only one
 * kind. */
export function quickOf(start: "command" | "treat", usual: Usual, exercises: readonly Named[], kinds: readonly Named[], quick: boolean): Quick | null {
  const { exercise, treatKind, commandTreat } = usualOf(usual, exercises, kinds);
  if (start === "treat") return treatKind && (quick || kinds.length === 1) ? { kind: "quick.treat", treatKindId: treatKind.id } : null;
  if (!quick || !exercise) return null;
  return { kind: "quick.command", exerciseId: exercise.id, ok: true, treatKindId: commandTreat ? treatKind?.id : undefined };
}

/** What the walk's buttons say they give: "Sitz · Käse" and "Käse"; nothing while there is no usual. */
export function quickLines(usual: Usual, exercises: readonly Named[], kinds: readonly Named[]): { command?: string; treat?: string } {
  const { exercise, treatKind, commandTreat } = usualOf(usual, exercises, kinds);
  return {
    command: exercise ? [exercise.name, commandTreat ? treatKind?.name : undefined].filter(Boolean).join(" · ") : undefined,
    treat: treatKind?.name,
  };
}
