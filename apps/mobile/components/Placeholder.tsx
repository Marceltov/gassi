// A tab that has no content yet: its title in the middle of the screen.
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";

export function Placeholder({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "bold" },
});
