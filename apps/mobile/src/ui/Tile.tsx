// One fact on the Start screen: what, when, and who; read out as one ("Draußen: vor 2 Std., Hirsch"). Lightly tinted in
// its kind's color (the gradient at low opacity over the surface) with its icon in a colored dot: calmer than the
// action tiles below.
import { StyleSheet, Text, View } from "react-native";
import { alpha, radius, type TileKind, useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

export function Tile({ label, value, by, kind, icon }: { label: string; value: string; by?: string; kind: TileKind; icon: IconName }) {
  const theme = useTheme();
  const [light, dark] = theme.gradients[kind];
  const [from, to] = theme.tint;
  return (
    <View
      testID={`tile-${label}`}
      accessible
      accessibilityLabel={`${label}: ${value}${by ? `, ${by}` : ""}`}
      style={[styles.tile, { backgroundColor: theme.surface, backgroundImage: `linear-gradient(135deg, ${alpha(light, from)}, ${alpha(dark, to)})` }]}
    >
      <View importantForAccessibility="no-hide-descendants">
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: theme[kind] }]}>
            <Icon name={icon} size={13} color="#fff" />
          </View>
          <Text style={[styles.small, { color: theme.muted }]}>{label}</Text>
        </View>
        <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
        {by ? <Text style={[styles.small, { color: theme.muted }]}>{by}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.tile, paddingVertical: 8, paddingHorizontal: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  small: { fontSize: 12 },
  value: { fontSize: 17, fontWeight: "700", marginVertical: 1 },
});
