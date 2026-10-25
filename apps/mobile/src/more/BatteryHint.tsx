// Akku (#108): what keeps Android from stopping the recording in the pocket, as two steps: Android's own question to
// leave the battery unoptimised, and One UI's list of apps that never sleep (no app can set or open that; the screen
// says where, and that the list doesn't offer an app whose battery is unrestricted already, #129). Opened once on the first walk this phone records, and from Mehr. "Weiter" leads to "Immer zulassen" unless
// it is set; "Später" goes back.
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Screen } from "../ui/Screen";
import { askBattery } from "../track/hints";
import { Step } from "./Step";
import { useHints } from "./useHints";

export function BatteryHint() {
  const theme = useTheme();
  const router = useRouter();
  const { always, battery, check, leave } = useHints();
  const next = () => (always ? leave() : router.push("/mehr/standort"));
  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Akku</Text>}
      top={
        <>
          <Text style={[styles.text, { color: theme.ink }]}>Damit Android die Strecke nicht mitten auf der Runde anhält, braucht Gassi zwei Einstellungen. Einmal, dann nie wieder.</Text>
          <Step n={1} title="Akku nicht optimieren" state={battery === null ? null : battery ? "erledigt ✓" : "noch eingeschränkt"} done={!!battery}>
            {battery ? null : (
              <>
                <Text style={[styles.small, { color: theme.muted }]}>Android fragt dann: „Im Hintergrund ausführen lassen?“ – Zulassen.</Text>
                <BigButton kind="side" size="s" label="Erlauben" onPress={() => void askBattery().finally(check)} />
              </>
            )}
          </Step>
          <Step n={2} title="Nie in den Standby" sub="Samsung schickt Apps sonst nach drei Tagen schlafen.">
            <Text style={[styles.small, { color: theme.muted }]}>
              Einstellungen › <Text style={{ color: theme.ink }}>Akku</Text> › <Text style={{ color: theme.ink }}>Hintergrundnutzungslimits</Text> › <Text style={{ color: theme.ink }}>Apps, die nie in den Standby-Modus wechseln</Text> › + › Gassi
            </Text>
            <Text style={[styles.small, { color: theme.muted }]}>Gassi fehlt in der Liste? Dann reicht Schritt 1: Samsung bietet dort nur Apps an, deren Akku noch optimiert wird.</Text>
          </Step>
        </>
      }
      bottom={<ButtonRow side={[<BigButton key="later" kind="side" size="m" label="Später" onPress={leave} />]} main={<BigButton kind="ink" size="m" label="Weiter" onPress={next} />} />}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  text: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 14, lineHeight: 20 },
});
