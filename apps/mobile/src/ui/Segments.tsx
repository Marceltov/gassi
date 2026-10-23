// A row of choices, one of them on (Nass | Trocken), or none yet (an encounter's scale, 0 ruhig … 4 explodiert, 1 … 10):
// a choice may have a small word under it. A tap reports its choice; the screen decides (a second tap may clear it).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type TileKind, useTheme } from "../theme";

type Props<T extends string> = { options: readonly { value: T; label: string; sub?: string }[]; value: T | null; onChange: (v: T) => void; kind?: TileKind | "neutral"; a11y?: string };

export function Segments<T extends string>({ options, value, onChange, kind = "neutral", a11y }: Props<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={a11y} style={[styles.switch, { borderColor: theme.line }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.sub ? `${o.label} ${o.sub}` : o.label}
            aria-selected={on}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: kind === "neutral" ? theme.neutral : theme[kind] }]}
          >
            <Text style={[styles.text, { color: on ? (kind === "neutral" ? theme.ink : "#fff") : theme.muted }]}>{o.label}</Text>
            {o.sub ? (
              <Text style={[styles.sub, { color: on ? (kind === "neutral" ? theme.ink : "#fff") : theme.muted }]} numberOfLines={1} adjustsFontSizeToFit>
                {o.sub}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, paddingHorizontal: 1, borderRadius: 10, minWidth: 0 },
  text: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 11 },
});
