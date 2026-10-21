// A big button for the thumb: an icon and the label, optionally a small line under it. A colored one has the depth of
// Start's tiles (its kind's diagonal gradient, a soft shadow, a light top edge); a neutral one stays calm (its surface
// with a faint shadow and edge). Disabled, it is flat and faded.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type ButtonKind, radius, useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

const sizes = { xl: { height: 100, font: 21, icon: 26 }, l: { height: 72, font: 17, icon: 22 }, m: { height: 52, font: 15, icon: 18 } };

type Props = {
  kind: ButtonKind;
  /** The words; empty for a button that is only its icon (then `a11y` says what it does). */
  label: string;
  icon?: IconName;
  sub?: string;
  onPress?: () => void;
  size?: keyof typeof sizes;
  /** Held down: for the "undo" of a counting tap. */
  onLongPress?: () => void;
  /** What a screen reader says, when the label alone is not enough ("klappt" per exercise); else the label. */
  a11y?: string;
  /** Greyed out and not tappable. */
  disabled?: boolean;
};

export function BigButton({ kind, label, icon, sub, onPress, onLongPress, a11y, disabled, size = "xl" }: Props) {
  const theme = useTheme();
  const { height, font, icon: iconSize } = sizes[size];
  const ink = kind === "neutral" ? theme.ink : "#fff";
  const depth = disabled
    ? null
    : kind === "neutral"
      ? { boxShadow: theme.calm }
      : { backgroundImage: `linear-gradient(135deg, ${theme.gradients[kind][0]}, ${theme.gradients[kind][1]})`, boxShadow: theme.pressable };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? (sub ? `${label}, ${sub}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.button, { height, backgroundColor: theme[kind], opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }, depth]}
    >
      <View style={styles.line}>
        {icon ? <Icon name={icon} size={iconSize} color={ink} /> : null}
        {label ? <Text style={[styles.label, { fontSize: font, color: ink }]}>{label}</Text> : null}
      </View>
      {sub ? <Text style={[styles.sub, { color: kind === "neutral" ? theme.muted : "#fff" }]}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2, opacity: 0.8 },
});
