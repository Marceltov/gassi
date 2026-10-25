// A big button for the thumb: an icon and the label, optionally a small line under it. A colored one has the depth of
// Start's tiles (its kind's diagonal gradient, a soft shadow, a light top edge); a neutral one stays calm (its surface
// with a faint shadow and edge); a side one is only outlined, a dangerSide one outlined in red; ink and danger are solid
// (#80). Disabled, it is flat and faded. `stacked` puts the icon above the label, for three side by side (the walk's
// Pipi, Markiert, Poopoo).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type ButtonKind, FIELD_HEIGHT, type Palette, radius, useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { events } from "../data/events";
import { tapName } from "../data/usage";

const sizes = { xl: { height: 100, font: 21, icon: 26 }, l: { height: 72, font: 17, icon: 22 }, m: { height: 52, font: 15, icon: 18 }, s: { height: FIELD_HEIGHT, font: 15, icon: 16 } };

type Props = {
  kind: ButtonKind;
  /** The words; empty for a button that is only its icon (then `a11y` says what it does). */
  label: string;
  icon?: IconName;
  sub?: string;
  onPress?: () => void;
  size?: keyof typeof sizes;
  /** Held down: the "undo" of a counting tap, or choosing what a tap gives (the walk's Leckerli). */
  onLongPress?: () => void;
  /** What a screen reader says, when the label alone is not enough ("klappt" per exercise); else the label. */
  a11y?: string;
  /** Greyed out and not tappable. */
  disabled?: boolean;
  stacked?: boolean;
  /** the tap's name in the app's usage events when label or a11y hold data (typed text, the household's names) */
  event?: string;
};

export function BigButton({ kind, label, icon, sub, onPress, onLongPress, a11y, event, disabled, stacked, size = "xl" }: Props) {
  const theme = useTheme();
  const { height, font, icon: iconSize } = sizes[size];
  const look = lookOf(kind, theme, !!disabled);
  // the button's name for the app's usage events (#115): what it says, never what was typed
  const tapped = (hold: boolean) => events.record("tap", tapName({ event, a11y, label }), hold ? { hold } : undefined);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? (sub ? `${label}, ${sub}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress && (() => (tapped(false), onPress()))}
      onLongPress={onLongPress && (() => (tapped(true), onLongPress()))}
      style={({ pressed }) => [styles.button, { height, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }, look.box, stacked && styles.narrow]}
    >
      <View style={[styles.line, stacked && styles.stacked]}>
        {icon ? <Icon name={icon} size={iconSize} color={look.ink} /> : null}
        {label ? <Text style={[styles.label, { fontSize: font, color: look.ink }]}>{label}</Text> : null}
      </View>
      {sub ? (
        <Text style={[styles.sub, { color: look.sub }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** How a kind looks: its box (background, outline, depth), its text and icon color, and the color of its small line. */
function lookOf(kind: ButtonKind, theme: Palette, disabled: boolean): { box: object; ink: string; sub: string } {
  switch (kind) {
    case "neutral":
      return { box: { backgroundColor: theme.neutral, ...(disabled ? {} : { boxShadow: theme.calm }) }, ink: theme.ink, sub: theme.muted };
    case "side":
      return { box: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.line }, ink: theme.ink, sub: theme.muted };
    case "dangerSide":
      return { box: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.danger }, ink: theme.danger, sub: theme.danger };
    case "ink":
      return { box: { backgroundColor: theme.ink, ...(disabled ? {} : { boxShadow: theme.pressable }) }, ink: theme.background, sub: theme.background };
    case "danger":
      return { box: { backgroundColor: theme.danger, ...(disabled ? {} : { boxShadow: theme.pressable }) }, ink: theme.background, sub: theme.background };
    default:
      return {
        box: { backgroundColor: theme[kind], ...(disabled ? {} : { backgroundImage: `linear-gradient(135deg, ${theme.gradients[kind][0]}, ${theme.gradients[kind][1]})`, boxShadow: theme.pressable }) },
        ink: "#fff",
        sub: "#fff",
      };
  }
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  stacked: { flexDirection: "column", gap: 2 },
  narrow: { paddingHorizontal: 4 },
  label: { fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 2, opacity: 0.8 },
});
