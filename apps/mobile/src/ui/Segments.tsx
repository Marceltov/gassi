// A row of two or three choices, one of them on (Nass | Trocken).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type TileKind, useTheme } from "../theme";

type Props<T extends string> = { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; kind?: TileKind | "neutral" };

export function Segments<T extends string>({ options, value, onChange, kind = "neutral" }: Props<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.switch, { borderColor: theme.line }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            aria-selected={on}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: kind === "neutral" ? theme.neutral : theme[kind] }]}
          >
            <Text style={[styles.text, { color: on ? (kind === "neutral" ? theme.ink : "#fff") : theme.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  text: { fontSize: 14, fontWeight: "700" },
});
