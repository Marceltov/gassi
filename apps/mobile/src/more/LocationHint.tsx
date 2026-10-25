// Standort im Hintergrund (#108): why "Immer zulassen" and where, drawn like Android's own choice. Recording runs
// without it while Android leaves Gassi alone; with it, it also goes on after Android ended Gassi or a restart. The
// main action opens Gassi's location permission (Android 11+), and once it is set says "Fertig".
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Screen } from "../ui/Screen";
import { askAlways } from "../track/hints";
import { useHints } from "./useHints";

const CHOICES = ["Immer zulassen", "Nur während der Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"];

export function LocationHint() {
  const theme = useTheme();
  const { always, check, leave } = useHints();
  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Standort im Hintergrund</Text>}
      top={
        <>
          <Text style={[styles.text, { color: theme.ink }]}>
            Gassi zeichnet die Strecke auch mit ausgeschaltetem Bildschirm auf. Mit <Text style={styles.bold}>„Immer zulassen“</Text> geht die Aufnahme auch weiter, wenn Android Gassi beendet oder das Handy neu startet.
          </Text>
          {always === null ? null : <Text style={[styles.text, { color: always ? theme.walk : theme.warn }]}>{always ? "Immer zulassen ✓" : "Jetzt: nur während der Nutzung der App"}</Text>}
          <Text style={[styles.label, { color: theme.muted }]}>IN DEN EINSTELLUNGEN WÄHLEN</Text>
          <View style={[styles.choices, { borderColor: theme.line }]}>
            {CHOICES.map((c, i) => (
              <View key={c} style={[styles.choice, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }, i === 0 && { backgroundColor: theme.surface }]}>
                <View style={[styles.dot, { borderColor: i === 0 ? theme.walk : theme.muted, backgroundColor: i === 0 ? theme.walk : "transparent" }]} />
                <Text style={[styles.small, { color: i === 0 ? theme.ink : theme.muted }]}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.small, { color: theme.muted }]}>Ohne geht es auch: Die Aufnahme läuft dann, solange Android Gassi nicht beendet.</Text>
        </>
      }
      bottom={
        <ButtonRow
          side={always ? [] : [<BigButton key="later" kind="side" size="m" label="Später" onPress={leave} />]}
          main={always ? <BigButton kind="ink" size="m" label="Fertig" onPress={leave} /> : <BigButton kind="ink" size="m" label="Einstellungen öffnen" onPress={() => void askAlways().finally(check)} />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  text: { fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: "700" },
  small: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, letterSpacing: 0.7 },
  choices: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  choice: { flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 12, paddingVertical: 11 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
});
