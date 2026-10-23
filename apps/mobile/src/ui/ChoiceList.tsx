// The choices of a sheet as one list: every option a full-width row, the chosen one marked with a check mark and the accent; an option may have an icon; a
// long list scrolls inside the sheet. Used for the Verlauf filters, the dog question and the Futter sheet's can size.
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { radius, useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

export type Choice = { key: string | number; label: string; icon?: IconName; on?: boolean; color?: string; onPress: () => void };

/** `accent`: the chosen one's color, the walk's unless the sheet belongs to something else (Futter). */
export function ChoiceList({ choices, accent }: { choices: readonly Choice[]; accent?: string }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const mark = accent ?? theme.walk;
  return (
    <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerStyle={styles.list}>
      {choices.map((c) => (
        <Pressable
          key={c.key}
          accessibilityRole="button"
          accessibilityLabel={c.label}
          accessibilityState={{ selected: !!c.on }}
          aria-pressed={!!c.on}
          onPress={c.onPress}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: c.on ? mark : theme.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          {c.color ? <View style={[styles.dot, { backgroundColor: c.color }]} /> : null}
          {c.icon ? <Icon name={c.icon} size={20} color={theme.muted} /> : null}
          <Text style={[styles.label, { color: theme.ink }]}>{c.label}</Text>
          {c.on ? (
            <View testID="choice-mark" style={[styles.check, { backgroundColor: mark }]}>
              <Icon name="check" size={17} color="#fff" />
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
});
