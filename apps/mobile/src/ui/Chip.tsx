// A small rounded label for a person, a dog or a can size, tappable: on (accent border and ✓) or off (outlined,
// muted); a dog's shows its color. `accent`: the color of the screen's kind (the food sheet's brown), else green.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

type Props = { label: string; onPress?: () => void; on?: boolean; color?: string; a11y?: string; accent?: string };

export function Chip({ label, onPress, on = true, color, a11y, accent }: Props) {
  const theme = useTheme();
  const mark = accent ?? theme.walk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      aria-pressed={on}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: on ? theme.surface : "transparent", borderColor: on ? mark : theme.line, opacity: pressed ? 0.7 : 1 }]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.label, { color: on ? theme.ink : theme.muted }]}>{label}</Text>
      {on ? (
        <View style={[styles.check, { backgroundColor: mark }]}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, borderWidth: 2, paddingHorizontal: 12, minHeight: 34 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 14, fontWeight: "600" },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
