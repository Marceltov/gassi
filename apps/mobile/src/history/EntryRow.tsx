// One entry in Verlauf: the time, a small map for a tracked walk, what it was ("🐕 Gassi · 42 Min. · 3,1 km"), what
// happened on a walk or which dog, and who. Tapping opens it.
import { describeEntry, type EntryType } from "@gassi/domain";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrackMap } from "../map/TrackMap";
import { radius, useTheme } from "../theme";
import { hhmm } from "../time";
import type { Entry } from "./form";

export const TYPE_ICON: Record<EntryType, string> = {
  walk: "🐕",
  food: "🥣",
  training: "🎯",
  pee: "💧",
  poop: "💩",
  weight: "⚖️",
  note: "📝",
  restock: "🛒",
  stockcheck: "📦",
};

type Props = { entry: Entry; dogs: string; onPress: () => void };

/** `dogs`: the dog names to show ("" when it is about all dogs, or the household has one). */
export function EntryRow({ entry, dogs, onPress }: Props) {
  const theme = useTheme();
  const d = describeEntry(entry);
  const routeKey = JSON.stringify(entry.route);
  // the same route keeps its map (a refresh brings a new array with the same points)
  const routes = useMemo(() => (routeKey !== "null" ? [JSON.parse(routeKey) as [number, number][]] : []), [routeKey]);
  const second = [d.during, dogs, entry.note ?? ""].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID={`entry-${entry.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.time, { color: theme.muted }]}>{hhmm(entry.at)}</Text>
      {routes.length ? (
        <View style={styles.thumb}>
          <TrackMap routes={routes} height={40} still />
        </View>
      ) : null}
      <View style={styles.main}>
        <Text style={[styles.line, { color: theme.ink }]}>
          <Text style={styles.title}>{`${TYPE_ICON[entry.type]} ${d.title}`}</Text>
          {d.extra ? ` · ${d.extra}` : ""}
        </Text>
        {second ? (
          <Text testID={`entry-${entry.id}-more`} style={[styles.small, { color: theme.muted }]} numberOfLines={2}>
            {second}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.by, { color: theme.muted }]} numberOfLines={2}>
        {d.by.replace(/^von /, "")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.tile, paddingVertical: 10, paddingHorizontal: 12, minHeight: 52 },
  time: { width: 40, fontSize: 13, fontVariant: ["tabular-nums"] },
  thumb: { width: 56, height: 40, borderRadius: 8, overflow: "hidden", pointerEvents: "none" },
  main: { flex: 1, gap: 2 },
  line: { fontSize: 15 },
  title: { fontWeight: "700" },
  small: { fontSize: 13 },
  by: { maxWidth: 110, fontSize: 12, textAlign: "right" },
});
