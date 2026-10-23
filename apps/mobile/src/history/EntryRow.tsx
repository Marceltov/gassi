// One entry in Verlauf: the time, a small map for a tracked walk, the type's icon in a dot of its color (and a strip of it
// on the left edge), two lines and who. The first line is the type in bold with its figures ("Gassi 42 Min. · 3,1 km"),
// the second the dogs, what happened on a walk and the note. An entry without dogs (a purchase, a count) has its
// figures on the second line, so the first isn't cut short while the second stays empty. Every row has the same height (#71): each line is cut
// short rather than wrapping, and the second is there even when empty. Tapping opens it.
import { describeEntry } from "@gassi/domain";
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
  const below = !dogs; // the figures go on the second line
  const extra = below ? "" : d.extra;
  const more = [below ? d.extra : "", dogs, d.during, entry.note ?? ""].filter(Boolean).join(" · ");
  const tone = theme[TYPE_TONE[entry.type]];
  return (
    <Pressable
      testID={`entry-${entry.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderLeftColor: tone, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.time, { color: theme.muted }]}>{hhmm(entry.at)}</Text>
      {routes.length ? (
        <View style={styles.thumb}>
          <TrackMap routes={routes} height={40} still />
        </View>
      ) : null}
      <View style={[styles.dot, { backgroundColor: tone }]}>
        <Icon name={TYPE_ICON[entry.type]} size={14} color="#fff" />
      </View>
      <View style={styles.main}>
        <Text style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
          {d.title}
          {extra ? <Text testID={`entry-${entry.id}-extra`} style={[styles.extra, { color: theme.ink }]}>{` ${extra}`}</Text> : null}
        </Text>
        <Text testID={`entry-${entry.id}-more`} style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
          {more || " "}
        </Text>
      </View>
      <Text style={[styles.by, { color: theme.muted }]} numberOfLines={2}>
        {d.by.replace(/^von /, "")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.tile, paddingLeft: 10, paddingRight: 12, height: ROW_HEIGHT, borderLeftWidth: 4 },
  time: { width: 40, fontSize: 13, fontVariant: ["tabular-nums"] },
  thumb: { width: 56, height: 40, borderRadius: 8, overflow: "hidden", pointerEvents: "none" },
  main: { flex: 1, gap: 2 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  extra: { fontWeight: "400" },
  small: { fontSize: 13 },
  by: { maxWidth: 110, fontSize: 12, textAlign: "right" },
});
