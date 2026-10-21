// One day as a 0–24 h strip: walks green, trainings blue as bars, feedings brown as ticks.
import type { WeekDay } from "@gassi/domain";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { barSpan, DAY, tickSpan } from "./geometry";

const pct = (min: number) => `${(100 * min) / DAY}%` as const;

export function Strip({ day }: { day: WeekDay }) {
  const theme = useTheme();
  const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" });
  return (
    <View style={styles.row}>
      <Text style={[styles.day, { color: theme.muted }]}>{label}</Text>
      <View testID={`strip-${day.date}`} style={[styles.track, { backgroundColor: theme.surface }]}>
        {[6, 12, 18].map((h) => (
          <View key={h} style={[styles.hour, { left: pct(h * 60), backgroundColor: theme.line }]} />
        ))}
        {day.bars.map((b, i) => {
          const { left, width } = barSpan(b.startMin, b.endMin);
          return <View key={`b${i}`} testID={`bar-${b.type}`} style={[styles.bar, { left: pct(left), width: pct(width), backgroundColor: theme[b.type] }]} />;
        })}
        {day.ticks
          .filter((t) => t.type === "food")
          .map((t, i) => {
            const { left, width, shift } = tickSpan(t.min);
            return <View key={`t${i}`} testID="tick-food" style={[styles.tick, { left: pct(left), width, marginLeft: shift, backgroundColor: theme.food }]} />;
          })}
      </View>
    </View>
  );
}

/** The hours under the strips: 0, 6, 12, 18, 24. */
export function StripHours() {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.day} />
      <View style={styles.hours}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Text key={h} style={[styles.hourText, { color: theme.muted }]}>
            {h}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  day: { width: 28, fontSize: 13 },
  track: { flex: 1, height: 22, borderRadius: 6, overflow: "hidden" },
  hour: { position: "absolute", top: 0, bottom: 0, width: 1 },
  bar: { position: "absolute", top: 3, bottom: 3, borderRadius: 4 },
  tick: { position: "absolute", top: 0, bottom: 0 },
  hours: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  hourText: { fontSize: 11 },
});
