// Start: the day at a glance on top, three big tiles at the bottom: Gassi gehen across, Futter and Training side by side
// below it, each with when it was last. A running walk or training shows its clock on its tile and is led back into. A
// tile on top opens Verlauf filtered to its type.
import { type EntryType, formatAgo, newId, TYPE_LABEL } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { FoodSheet } from "../food/FoodSheet";
import { useGassi } from "../data/GassiProvider";
import type { TileKind } from "../theme";
import type { IconName } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Tile } from "../ui/Tile";
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
  const { view, send } = useGassi();
  const today = useToday();
  const now = useNow(view.walk || view.training ? 1000 : 30_000);
  const [foodOpen, setFoodOpen] = useState(false);

  // A second tap before the screen has caught up must not start a second walk or training.
  const { leave } = useLeaving();
  const open = (path: "/runde" | "/training") => leave(() => router.push(path));
  // a fact tile opens Verlauf with its type chosen
  const tile = (label: string, entry: Entry, type: Shown, icon: IconName) => {
    const when = entry ? formatAgo(Date.parse(entry.endedAt ?? entry.at), now) : "noch nicht";
    const show = () => leave(() => router.navigate({ pathname: "/verlauf", params: { type } }));
    return <Tile label={label} value={when} by={entry?.byName} kind={type} icon={icon} a11y={`${TYPE_LABEL[type]} im Verlauf zeigen`} onPress={show} />;
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
          <View style={styles.row}>
            {tile("Draußen", today.walk, "walk", "walk")}
            {tile("Gefressen", today.food, "food", "food")}
          </View>
          <View style={styles.row}>
            {tile("Pipi", today.pee, "pee", "pee")}
            {tile("Poopoo", today.poop, "poop", "poop")}
          </View>
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
          <FoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
});
