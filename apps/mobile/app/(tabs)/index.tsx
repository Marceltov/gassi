import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";
import { BigButton } from "@/src/ui/BigButton";
import { Screen } from "@/src/ui/Screen";
import { Sheet } from "@/src/ui/Sheet";
import { Tile } from "@/src/ui/Tile";

// Placeholder that shows the building blocks with the mockup's copy; the real Start screen replaces it.
export default function StartScreen() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Screen
      top={
        <>
          <View style={styles.row}>
            <Text style={[styles.dog, { color: theme.muted }]}>Toffee</Text>
            <Text style={[styles.dog, { color: theme.muted }]}>Hirsch</Text>
          </View>
          <View style={styles.row}>
            <Tile label="Draußen" value="vor 3 h" by="Herzii" />
            <Tile label="Gefressen" value="vor 5 h" by="Hirsch" />
          </View>
          <View style={styles.row}>
            <Tile label="Pipi" value="vor 3 h" by="Herzii" />
            <Tile label="Poopoo" value="7:40" by="Herzii" />
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="pee" size="l" label="💧 Pipi" />
            </View>
            <View style={styles.cell}>
              <BigButton kind="poop" size="l" label="💩 Poopoo" />
            </View>
          </View>
          <BigButton kind="neutral" size="m" label="⏸ Pause" sub="seit 14:02" />
        </>
      }
      bottom={
        <>
          <BigButton kind="walk" label="🐕 Gassi gehen" />
          <BigButton kind="food" size="l" label="🥣 Futter geben" onPress={() => setOpen(true)} />
          <BigButton kind="training" size="l" label="🎯 Training starten" />
          <Sheet open={open} onClose={() => setOpen(false)}>
            <Text style={[styles.title, { color: theme.ink }]}>Futter geben</Text>
            <BigButton kind="food" size="m" label="Fertig" onPress={() => setOpen(false)} />
          </Sheet>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cell: { flex: 1 },
  dog: { fontSize: 12 },
  title: { fontSize: 17, fontWeight: "700" },
});
