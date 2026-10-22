// A labelled text field: the label above, the input in a surface box, FIELD_HEIGHT tall (a small button fits beside it).
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { FIELD_HEIGHT, radius, useTheme } from "../theme";

type Props = { label: string; value: string; onChangeText: (v: string) => void } & Pick<TextInputProps, "keyboardType" | "placeholder" | "onSubmitEditing" | "autoFocus" | "inputMode">;

export function Field({ label, ...input }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={theme.muted} {...input} style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4, minWidth: 0 },
  label: { fontSize: 13 },
  input: { height: FIELD_HEIGHT, borderRadius: radius.tile, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, minWidth: 0 },
});
