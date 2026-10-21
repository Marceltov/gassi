// A small rounded label for a person or a dog, tappable: on (filled) or off (outlined); a dog's shows its color.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

type Props = { label: string; onPress?: () => void; on?: boolean; color?: string; a11y?: string };

export function Chip({ label, onPress, on = true, color, a11y }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      aria-pressed={on}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: on ? theme.surface : "transparent", borderColor: on ? theme.surface : theme.line, opacity: pressed ? 0.7 : 1 }]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.label, { color: on ? theme.ink : theme.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, minHeight: 34 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 14, fontWeight: "600" },
});
