// One fact on the Start screen: what, when, and who.
import { StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";

export function Tile({ label, value, by }: { label: string; value: string; by?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface }]}>
      <Text style={[styles.small, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
      {by ? <Text style={[styles.small, { color: theme.muted }]}>{by}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.tile, paddingVertical: 8, paddingHorizontal: 12 },
  small: { fontSize: 12 },
  value: { fontSize: 17, fontWeight: "700", marginVertical: 1 },
});
