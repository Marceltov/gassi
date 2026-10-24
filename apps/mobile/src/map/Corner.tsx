// The button in a map's corner that shows it on the whole screen ("expand") or small again ("shrink"), on the web's
// map and Android's alike.
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "../theme";
import { Icon } from "../ui/Icon";

export function Corner({ icon, label, onPress }: { icon: "expand" | "shrink"; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.corner, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // above the map's own controls (Leaflet's z-index is 1000), in the corner they leave free
  corner: { position: "absolute", top: 8, right: 8, zIndex: 1001, width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
