// Stand-in for the walk and training screens until they are built: the title and the running clock.
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { walkClock } from "./elapsed";
import { useNow } from "./useNow";

export function RunningPlaceholder({ title, kind }: { title: string; kind: "walk" | "training" }) {
  const theme = useTheme();
  const { view } = useGassi();
  const now = useNow(1000);
  const session = view[kind];
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      {session ? <Text style={[styles.clock, { color: theme.ink }]}>{kind === "walk" && view.walk ? walkClock(view.walk, now) : "läuft"}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "bold" },
  clock: { fontSize: 48, fontWeight: "700" },
});
