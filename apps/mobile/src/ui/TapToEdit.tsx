// A value that reads as plain text and turns into a field when tapped (on the web a click; a double click too);
// Enter or leaving the field ends editing. `label` names it for the screen reader in both states (as text with its value:
// "Anzahl Dosen à 400 g, 2,5"); `width` keeps both states the same size, so the row doesn't move.
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, type TextStyle } from "react-native";
import { useTheme } from "../theme";

type Props = { label: string; value: string; onChange: (v: string) => void; placeholder?: string; startEditing?: boolean; testID?: string; style?: TextStyle; warn?: boolean; width: number } & Pick<TextInputProps, "inputMode" | "keyboardType">;

export function TapToEdit({ label, value, onChange, placeholder = "…", startEditing = false, testID, style, warn, width, ...input }: Props) {
  const theme = useTheme();
  const [editing, setEditing] = useState(startEditing);
  if (editing)
    return (
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onBlur={() => setEditing(false)}
        onSubmitEditing={() => setEditing(false)}
        autoFocus
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        {...input}
        style={[styles.text, style, styles.field, { width, minWidth: width, maxWidth: width, color: theme.ink, borderColor: theme.line, backgroundColor: theme.background }]}
      />
    );
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}, ${value || "leer"}`} onPress={() => setEditing(true)} hitSlop={6} style={{ width }}>
      <Text style={[styles.text, style, { color: value ? theme.ink : theme.muted }, warn ? { textDecorationLine: "underline", textDecorationColor: theme.pee } : null]}>{value || placeholder}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, fontWeight: "700", paddingVertical: 6, paddingHorizontal: 4 },
  field: { borderRadius: 8, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 3 },
});
