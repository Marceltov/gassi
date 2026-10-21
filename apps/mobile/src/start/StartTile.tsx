// One of Start's big tiles (Gassi gehen, Futter, Training): the kind's color as a diagonal gradient with a soft shadow
// and a light top edge, the icon in a light circle at the top left, the title and a line under it (when it was last,
// or the running clock). Read out as what it does and that line ("Futter geben, zuletzt 80 g nass").
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, type TileKind, useTheme } from "../theme";
import { Icon, type IconName } from "../ui/Icon";

type Props = { kind: TileKind; icon: IconName; title: string; line: string; a11y: string; onPress: () => void; big?: boolean };

export function StartTile({ kind, icon, title, line, a11y, onPress, big }: Props) {
  const theme = useTheme();
  const [light, dark] = theme.gradients[kind];
  const circle = big ? 48 : 40;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { height: big ? 150 : 126, backgroundColor: theme[kind], backgroundImage: `linear-gradient(135deg, ${light}, ${dark})`, boxShadow: theme.raised, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.circle, { width: circle, height: circle, borderRadius: circle / 2 }]}>
        <Icon name={icon} size={big ? 28 : 22} color="#fff" />
      </View>
      <View>
        <Text style={[styles.title, { fontSize: big ? 24 : 18 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.bigTile, paddingVertical: 14, paddingHorizontal: 16, justifyContent: "space-between" },
  circle: { backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontWeight: "800" },
  line: { color: "#fff", fontSize: 13, fontWeight: "600", opacity: 0.9, marginTop: 2 },
});
