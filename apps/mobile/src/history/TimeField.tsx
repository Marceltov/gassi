// The native picker comes with the Android app (step 3); until then the time is typed as "2026-10-20T14:05". Same
// props as TimeField.web.tsx.
import { localToUtc, utcToLocal } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { TIME_ZONE } from "../time";

export type TimeFieldProps = { label: string; value: string; onChange: (iso: string) => void };

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const theme = useTheme();
  const [typed, setTyped] = useState<string | null>(null);
  const done = () => {
    if (typed && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(typed)) onChange(new Date(localToUtc(typed, TIME_ZONE)).toISOString());
    setTyped(null);
  };
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={typed ?? utcToLocal(Date.parse(value), TIME_ZONE)}
        onChangeText={setTyped}
        onEndEditing={done}
        style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16 },
});
