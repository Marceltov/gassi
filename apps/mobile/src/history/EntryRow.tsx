// One entry in Verlauf: the time, the type's icon in a dot of its color (and a strip of it on the left edge), two lines,
// a small map for a tracked walk and who. The icon and the lines start at the same place in every row. The first line is
// what kind it is ("Gassi"), the second what it says in bold ("42 Min. · 3,1 km"), then the dogs, what happened on a
// walk and the note. A row is that high and its lines are cut short rather than wrapping (#71), unless it has more to
// show: a wet count has a line per size. Taller, never shorter. Tapping opens it.
import { cansOf, describeEntry, formatCanCount } from "@gassi/domain";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrackMap } from "../map/TrackMap";
import { radius, useTheme } from "../theme";
import { hhmm } from "../time";
import { Icon } from "../ui/Icon";
import { TYPE_ICON, TYPE_TONE } from "../ui/icons";
import type { Entry } from "./form";

const ROW_HEIGHT = 60;

type Props = { entry: Entry; dogs: string; onPress: () => void };

/** `dogs`: the dog names ("" for an entry without dogs, such as a purchase). */
export function EntryRow({ entry, dogs, onPress }: Props) {
  const theme = useTheme();
  const d = describeEntry(entry);
  const routeKey = JSON.stringify(entry.route);
  // the same route keeps its map (a refresh brings a new array with the same points)
  const routes = useMemo(() => (routeKey !== "null" ? [JSON.parse(routeKey) as [number, number][]] : []), [routeKey]);
  const rest = [dogs, d.during, entry.note ?? ""].filter(Boolean).join(" · ");
  const tone = theme[TYPE_TONE[entry.type]];
  const sizes = entry.type === "stockcheck" && entry.count?.length ? entry.count : null; // a wet count: a line each
  return (
    <Pressable
      testID={`entry-${entry.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderLeftColor: tone, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.time, { color: theme.muted }]}>{hhmm(entry.at)}</Text>
      <View style={[styles.dot, { backgroundColor: tone }]}>
        <Icon name={TYPE_ICON[entry.type]} size={14} color="#fff" />
      </View>
      <View style={styles.main}>
        <Text testID={`entry-${entry.id}-title`} style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
          {d.title}
        </Text>
        {sizes ? (
          sizes.map((r) => (
            <Text key={r.unitG} testID={`entry-${entry.id}-size`} style={[styles.small, styles.figures, { color: theme.ink }]} numberOfLines={1}>
              {formatCanCount({ unitG: r.unitG, cans: cansOf(r.amountG, r.unitG) })}
            </Text>
          ))
        ) : (
          <Text testID={`entry-${entry.id}-more`} style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
            {d.extra ? <Text testID={`entry-${entry.id}-extra`} style={[styles.figures, { color: theme.ink }]}>{d.extra}</Text> : null}
            {d.extra && rest ? " · " : ""}
            {rest || (d.extra ? "" : " ")}
          </Text>
        )}
      </View>
      {routes.length ? (
        <View style={styles.thumb}>
          <TrackMap routes={routes} height={40} still />
        </View>
      ) : null}
      <Text style={[styles.by, { color: theme.muted }]} numberOfLines={2}>
        {d.by.replace(/^von /, "")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.tile, paddingLeft: 10, paddingRight: 12, paddingVertical: 8, minHeight: ROW_HEIGHT, borderLeftWidth: 4 },
  time: { width: 40, fontSize: 13, fontVariant: ["tabular-nums"] },
  thumb: { width: 56, height: 40, borderRadius: 8, overflow: "hidden", pointerEvents: "none" },
  main: { flex: 1, gap: 2 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15 },
  figures: { fontWeight: "700" }, // what the entry says, not what kind it is
  small: { fontSize: 13 },
  by: { maxWidth: 110, fontSize: 12, textAlign: "right" },
});
