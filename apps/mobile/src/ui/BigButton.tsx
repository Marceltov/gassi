// A big colored button for the thumb: the label, optionally a small line under it.
import { Pressable, StyleSheet, Text } from "react-native";
import { type ButtonKind, radius, useTheme } from "../theme";

const sizes = { xl: { height: 100, font: 21 }, l: { height: 72, font: 17 }, m: { height: 52, font: 15 } };

type Props = {
  kind: ButtonKind;
  label: string;
  sub?: string;
  onPress?: () => void;
  size?: keyof typeof sizes;
  /** Held down: for the "undo" of a counting tap. */
  onLongPress?: () => void;
  /** What a screen reader says, when the label alone is not enough (a "✓" per exercise). */
  a11y?: string;
  /** Greyed out and not tappable. */
  disabled?: boolean;
};

export function BigButton({ kind, label, sub, onPress, onLongPress, a11y, disabled, size = "xl" }: Props) {
  const theme = useTheme();
  const { height, font } = sizes[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? (sub ? `${label}, ${sub}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.button, { height, backgroundColor: theme[kind], opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.label, { fontSize: font, color: kind === "neutral" ? theme.ink : "#fff" }]}>{label}</Text>
      {sub ? <Text style={[styles.sub, { color: kind === "neutral" ? theme.muted : "#fff" }]}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  label: { fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2, opacity: 0.8 },
});
