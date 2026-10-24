// How a repetition went, as a button (#100): ✓ klappt green, ~ geht so amber, ✗ klappt nicht grey, the icon above the
// word so that three fit side by side (the training's exercises, the Kommando sheet). A screen reader hears what it is
// about and the whole meaning: "Sitz klappt, aber könnte besser sein".
import type { Grade } from "@gassi/domain";
import type { ButtonKind } from "../theme";
import { BigButton } from "./BigButton";
import type { IconName } from "./Icon";

const LOOK: Record<Grade, { kind: ButtonKind; icon: IconName; label: string; says: string }> = {
  ok: { kind: "walk", icon: "check", label: "klappt", says: "klappt" },
  meh: { kind: "meh", icon: "meh", label: "geht so", says: "klappt, aber könnte besser sein" },
  fail: { kind: "neutral", icon: "cross", label: "klappt nicht", says: "klappt nicht" },
};

type Props = { grade: Grade; size: "m" | "l"; what?: string; disabled?: boolean; onPress: () => void; onLongPress?: () => void };

export function GradeButton({ grade, size, what, disabled, onPress, onLongPress }: Props) {
  const look = LOOK[grade];
  return <BigButton kind={look.kind} size={size} icon={look.icon} label={look.label} a11y={what ? `${what} ${look.says}` : look.says} stacked disabled={disabled} onPress={onPress} onLongPress={onLongPress} />;
}
