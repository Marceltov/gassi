// The choices of a sheet as one list: every option a full-width row, the chosen one marked with ✓ and the accent; a
// long list scrolls inside the sheet. Used for the Verlauf filters and the dog question.
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { radius, useTheme } from "../theme";
import { spoken } from "./spoken";

export type Choice = { key: string | number; label: string; on?: boolean; color?: string; onPress: () => void };

export function ChoiceList({ choices }: { choices: readonly Choice[] }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  return (
    <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerStyle={styles.list}>
      {choices.map((c) => (
        <Pressable
          key={c.key}
          accessibilityRole="button"
          accessibilityLabel={spoken(c.label)}
          accessibilityState={{ selected: !!c.on }}
          aria-pressed={!!c.on}
          onPress={c.onPress}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: c.on ? theme.walk : theme.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          {c.color ? <View style={[styles.dot, { backgroundColor: c.color }]} /> : null}
          <Text style={[styles.label, { color: theme.ink }]}>{c.label}</Text>
          {c.on ? (
            <View style={[styles.check, { backgroundColor: theme.walk }]}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: radius.tile, borderWidth: 2, paddingHorizontal: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { flex: 1, fontSize: 16, fontWeight: "600" },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
