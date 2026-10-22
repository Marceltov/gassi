// A month as weeks from Monday: each day of the month a button, with a value under its number when it has one (a
// weight's "7,0"); today framed. Days of the months around it are faint and days after today can't be tapped. It takes
// the height it is given (its weeks share it).
import { type CalendarDay, monthGrid } from "@gassi/domain";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, radius, useTheme } from "../theme";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Props = { month: string; today: string; valueOf: (date: string) => string | null; label: (date: string) => string; onPress: (date: string) => void; tone: string };

export function MonthCalendar({ month, today, valueOf, label, onPress, tone }: Props) {
  const theme = useTheme();
  const day = (d: CalendarDay) => {
    const value = d.inMonth ? valueOf(d.date) : null;
    const tappable = d.inMonth && d.date <= today;
    return (
      <Pressable
        key={d.date}
        testID={d.inMonth ? `day-${d.date}` : undefined}
        accessibilityRole={tappable ? "button" : undefined}
        accessibilityLabel={d.inMonth ? `${label(d.date)}${value ? `, ${value} kg` : ""}` : undefined}
        disabled={!tappable}
        onPress={() => onPress(d.date)}
        style={({ pressed }) => [
          styles.day,
          value ? { backgroundColor: alpha(tone, 0.22) } : null,
          d.date === today ? { borderColor: theme.ink } : null,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.number, { color: !d.inMonth || d.date > today ? alpha(theme.muted, 0.5) : theme.ink }]}>{Number(d.date.slice(8))}</Text>
        {value ? <Text style={[styles.value, { color: theme.ink }]}>{value}</Text> : null}
      </Pressable>
    );
  };
  return (
    <View testID="month-calendar" style={[styles.box, { backgroundColor: theme.surface }]}>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.head, { color: theme.muted }]}>
            {w}
          </Text>
        ))}
      </View>
      {monthGrid(month).map((week) => (
        <View key={week[0].date} style={styles.week}>
          {week.map(day)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 2, minHeight: 150, borderRadius: radius.tile, padding: 8, gap: 3 },
  weekdays: { flexDirection: "row", gap: 3 },
  week: { flex: 1, flexDirection: "row", gap: 3 },
  head: { flex: 1, textAlign: "center", fontSize: 11 },
  day: { flex: 1, minHeight: 24, borderRadius: 8, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  number: { fontSize: 13 },
  value: { fontSize: 11, fontWeight: "700" },
});
