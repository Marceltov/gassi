// A small action under bigger ones (Start's Kommando, Leckerli, Begegnung, Notiz): a circle in the color of its kind with
// a white icon, the word small under it, no frame, so the row stays a quiet second tier under the tiles.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type ListTone, useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

export function RoundAction({ label, icon, tone, onPress }: { label: string; icon: IconName; tone: ListTone; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.circle, { backgroundColor: theme[tone] }]}>
        <Icon name={icon} size={20} color="#fff" />
      </View>
      <Text style={[styles.label, { color: theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 4, minWidth: 0 },
  circle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12 },
});
