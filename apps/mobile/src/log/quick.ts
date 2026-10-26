// What is usual on this phone for a command or a treat (#36, #98): the last command's exercise and whether it came with
// a treat, and the Leckerli on you (the kind given last, one for both). On a walk a tap on Leckerli gives the usual
// without a sheet, and a tap on Kommando asks only klappt or klappt nicht for the usual (#114); with only one kind there
// is, a treat never asks.
type Usual = { exerciseId?: number; treatKindId?: number | null; commandTreat?: boolean };
type Named = { id: number; name: string };

/** A command's exercise and the Leckerli it gives when it worked. */
export type Asked = { exerciseId: number; treatKindId?: number };

/** What a tap does without the form: a treat logged at once, or a command's usual asked klappt or klappt nicht; null
 * when there is more to choose. */
export type Quick = { kind: "quick.treat"; treatKindId: number } | ({ kind: "ask" } & Asked);

/** The usual exercise and Leckerli among the household's, and whether a command comes with one. */
export function usualOf(usual: Usual, exercises: readonly Named[], kinds: readonly Named[]): { exercise?: Named; treatKind?: Named; commandTreat: boolean } {
  return {
    exercise: exercises.find((e) => e.id === usual.exerciseId),
    treatKind: kinds.length === 1 ? kinds[0] : kinds.find((k) => k.id === usual.treatKindId),
    commandTreat: usual.commandTreat !== false,
  };
}

/** What a tap on Kommando or Leckerli does without the form: on a walk (`quick`) the usual (a command's only asked
 * klappt or klappt nicht), else a treat when there is only one kind. */
export function quickOf(start: "command" | "treat", usual: Usual, exercises: readonly Named[], kinds: readonly Named[], quick: boolean): Quick | null {
  const { exercise, treatKind, commandTreat } = usualOf(usual, exercises, kinds);
  if (start === "treat") return treatKind && (quick || kinds.length === 1) ? { kind: "quick.treat", treatKindId: treatKind.id } : null;
  if (!quick || !exercise) return null;
  return { kind: "ask", exerciseId: exercise.id, treatKindId: commandTreat ? treatKind?.id : undefined };
}

/** The command for an answer: a Leckerli only when it worked. */
export function commandOf({ exerciseId, treatKindId }: Asked, dogId: number, ok: boolean, id: string, at: string) {
  return { id, at, kind: "quick.command" as const, dogId, exerciseId, ok, treatKindId: ok ? treatKindId : undefined };
}

/** What the walk's buttons say they give: "Sitz" and "Käse" (a command's treat is the one under Leckerli, so its
 * button names only the exercise, #141); nothing while there is no usual. */
export function quickLines(usual: Usual, exercises: readonly Named[], kinds: readonly Named[]): { command?: string; treat?: string } {
  const { exercise, treatKind } = usualOf(usual, exercises, kinds);
  return {
    command: exercise?.name,
    treat: treatKind?.name,
  };
}
