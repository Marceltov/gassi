// A time typed as "2026-10-20T14:05" on Android, saved as soon as the text is a complete time; leaving the field with
// an unfinished one shows the time as it was. Same props as TimeField.web.tsx.
import { localToUtc, utcToLocal } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { TIME_ZONE } from "../time";

export type TimeFieldProps = { label: string; value: string; onChange: (iso: string) => void };

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const theme = useTheme();
  const [typed, setTyped] = useState<string | null>(null);
  const type = (text: string) => {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
      onChange(new Date(localToUtc(text, TIME_ZONE)).toISOString());
      setTyped(null);
    } else setTyped(text);
  };
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={typed ?? utcToLocal(Date.parse(value), TIME_ZONE)}
        onChangeText={type}
        onEndEditing={() => setTyped(null)}
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
