// Start: the day at a glance on top as one list (#83): Draußen, Gefressen, Trainiert, Pipi, Poopoo, each since when and
// who, the times in one column; three big tiles at the bottom: Gassi gehen across, Futter and Training side by side
// below it, each with when it was last; under them Begegnung and Notiz, small (#90, #37, #91). A running walk or training shows its clock on its tile and is led back into. A
// row on top opens Verlauf filtered to its type.
import { type EntryType, formatAgoShort, newId, TYPE_LABEL } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FoodSheet } from "../food/FoodSheet";
import { EncounterChoice, type LogKind, LogSheet } from "../log/LogSheet";
import { BigButton } from "../ui/BigButton";
import { useGassi } from "../data/GassiProvider";
import { type TileKind, useTheme } from "../theme";
import type { IconName } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Group, Row } from "../ui/List";
import { useLeaving } from "../ui/useLeaving";
import { trainingClock, walkClock } from "./elapsed";
import { lastFeeding, lastTraining, lastWalk } from "./lines";
import { StartTile } from "./StartTile";
import { useNow } from "./useNow";
import { type Today, useToday } from "./useToday";

type Entry = Today["walk"];
type Shown = TileKind & EntryType;

export function Start() {
  const router = useRouter();
  const { view, send, dogs } = useGassi();
  const [encounter, setEncounter] = useState(false);
  const [logging, setLogging] = useState<LogKind | null>(null);
  const today = useToday();
  const theme = useTheme();
  const now = useNow(view.walk || view.training ? 1000 : 30_000);
  const [foodOpen, setFoodOpen] = useState(false);

  // A second tap before the screen has caught up must not start a second walk or training.
  const { leave } = useLeaving();
  const open = (path: "/runde" | "/training") => leave(() => router.push(path));
  // a row of the day at a glance: since when and who; it opens Verlauf with its type chosen
  const fact = (label: string, entry: Entry, type: Shown, icon: IconName) => {
    const when = entry ? formatAgoShort(Date.parse(entry.endedAt ?? entry.at), now) : "noch nicht";
    const show = () => leave(() => router.navigate({ pathname: "/verlauf", params: { type } }));
    return (
      <Row
        testID={`tile-${label}`}
        label={label}
        icon={icon}
        tone={type}
        a11y={`${TYPE_LABEL[type]} im Verlauf zeigen, ${when}${entry ? `, ${entry.byName}` : ""}`}
        onPress={show}
        right={
          <View style={styles.since}>
            <Text testID={`tile-${label}-since`} style={[styles.when, { color: theme.ink }]} numberOfLines={1}>
              {when}
            </Text>
            <Text style={[styles.by, { color: theme.muted }]} numberOfLines={1}>
              {entry?.byName ?? ""}
            </Text>
          </View>
        }
      />
    );
  };
  const startWalk = () =>
    leave(() => {
      send({ id: newId(), at: new Date().toISOString(), kind: "walk.start", walkKey: newId() });
      router.push("/runde");
    });
  const startTraining = () =>
    leave(() => {
      send({ id: newId(), at: new Date().toISOString(), kind: "training.start", trainingKey: newId(), walkKey: view.walk?.key });
      router.push("/training");
    });

  return (
    <Screen
      top={
        <>
          <Group>
            {fact("Draußen", today.walk, "walk", "walk")}
            {fact("Gefressen", today.food, "food", "food")}
            {fact("Trainiert", today.training, "training", "training")}
            {fact("Pipi", today.pee, "pee", "pee")}
            {fact("Poopoo", today.poop, "poop", "poop")}
          </Group>
        </>
      }
      bottom={
        <>
          {view.walk ? (
            <StartTile big kind="walk" icon="walk" title="Gassi gehen" line={`Runde läuft · ${walkClock(view.walk, now)}`} a11y={`Runde läuft · ${walkClock(view.walk, now)}`} onPress={() => open("/runde")} />
          ) : (
            <StartTile big kind="walk" icon="walk" title="Gassi gehen" line={lastWalk(today.walk, now)} a11y={`Gassi gehen, ${lastWalk(today.walk, now)}`} onPress={startWalk} />
          )}
          <View style={styles.row}>
            <View style={styles.cell}>
              <StartTile kind="food" icon="food" title="Futter" line={lastFeeding(today.food, now)} a11y={`Futter geben, ${lastFeeding(today.food, now)}`} onPress={() => setFoodOpen(true)} />
            </View>
            <View style={styles.cell}>
              {view.training ? (
                <StartTile kind="training" icon="training" title="Training" line={`läuft · ${trainingClock(view.training, now)}`} a11y={`Training läuft · ${trainingClock(view.training, now)}`} onPress={() => open("/training")} />
              ) : (
                <StartTile kind="training" icon="training" title="Training" line={lastTraining(today.training, now)} a11y={`Training starten, ${lastTraining(today.training, now)}`} onPress={startTraining} />
              )}
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="side" size="s" icon="people" label="Begegnung" onPress={() => setEncounter(true)} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="side" size="s" icon="note" label="Notiz" onPress={() => setLogging("note")} />
            </View>
          </View>
          <FoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} />
          <EncounterChoice
            open={encounter}
            onPick={(kind) => {
              setEncounter(false);
              setLogging(kind);
            }}
            onClose={() => setEncounter(false)}
          />
          <LogSheet kind={logging} dogIds={dogs.filter((d) => !d.archived).map((d) => d.id)} place="home" onClose={() => setLogging(null)} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  // the times right-aligned in one column, who beside them
  since: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "baseline", gap: 10 },
  when: { flexShrink: 0, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  by: { width: 56, fontSize: 12, textAlign: "right" },
});
