// A date and time on Android, with Android's own pickers: the field shows "So., 25. Okt., 09:15", a tap asks the day,
// then the time, and saves once both are picked; cancelling either leaves it as it was. Same props as
// TimeField.web.tsx; `value` and what `onChange` gets are ISO instants (the pickers work in this phone's time zone,
// as TIME_ZONE does).
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";
import { dayTime } from "../time";
import { picked } from "./picked";

export type TimeFieldProps = { label: string; value: string; onChange: (iso: string) => void };

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const theme = useTheme();
  const ask = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: "date",
      onChange: (event, day) => {
        if (event.type !== "set" || !day) return;
        DateTimePickerAndroid.open({
          value: new Date(value),
          mode: "time",
          is24Hour: true,
          onChange: (e, time) => {
            if (e.type === "set" && time) onChange(picked(day, time).toISOString());
          },
        });
      },
    });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${dayTime(value)}`} onPress={ask} style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}>{dayTime(value)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, overflow: "hidden" },
});
