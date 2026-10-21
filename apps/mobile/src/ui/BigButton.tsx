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
};

export function BigButton({ kind, label, sub, onPress, size = "xl" }: Props) {
  const theme = useTheme();
  const { height, font } = sizes[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { height, backgroundColor: theme[kind], opacity: pressed ? 0.8 : 1 }]}
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
