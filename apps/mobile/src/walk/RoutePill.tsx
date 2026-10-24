// The walk's route in one line under the walkers (#104): on the phone that records, the distance so far ("● 1,4 km ›"),
// in amber when there is no fix ("kein GPS-Signal") or location is refused ("GPS aus"); on the others, who records.
// A tap opens the route (RouteSheet). One line of fixed height, so nothing below it moves.
import { formatDistance } from "@gassi/domain";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";
import { useRecording } from "../track/Recording";

export function RoutePill({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { mine, status, distanceM, recorderName } = useRecording();
  const text = !mine ? (recorderName ? `Strecke: ${recorderName}` : "Keine Strecke") : status === "denied" ? "GPS aus" : status === "noSignal" ? "kein GPS-Signal" : `● ${formatDistance(distanceM)}`;
  const color = !mine ? theme.muted : status === "on" ? theme.walk : theme.warn;
  return (
    <Pressable testID="route-pill" accessibilityRole="button" accessibilityLabel={`${text}, Strecke zeigen`} onPress={onPress} style={[styles.pill, { backgroundColor: theme.surface }]}>
      <Text numberOfLines={1} style={[styles.text, { color }]}>{`${text} ›`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "center", height: 28, borderRadius: 14, paddingHorizontal: 12, justifyContent: "center", maxWidth: "100%" },
  text: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
