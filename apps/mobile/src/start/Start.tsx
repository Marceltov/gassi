// Start: the day at a glance on top, three big buttons at the bottom. A running walk or training is led back into.
import { formatAgo, newId } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { Tile } from "../ui/Tile";
import { walkClock } from "./elapsed";
import { useNow } from "./useNow";
import { type Today, useToday } from "./useToday";

type Entry = Today["walk"];

function tile(label: string, entry: Entry, now: number) {
  const when = entry ? formatAgo(Date.parse(entry.endedAt ?? entry.at), now) : "noch nicht";
  return <Tile label={label} value={when} by={entry?.byName} />;
}

export function Start() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send } = useGassi();
  const today = useToday();
  const now = useNow(1000, !!view.walk);
  const minute = useNow(30_000, !view.walk);
  const clock = view.walk ? now : minute;
  // The food sheet opens here; Task 6 fills it with the portion, kind and dogs.
  const [foodOpen, setFoodOpen] = useState(false);

  const startWalk = () => {
    send({ id: newId(), at: new Date().toISOString(), kind: "walk.start", walkKey: newId() });
    router.push("/runde");
  };
  const startTraining = () => {
    send({ id: newId(), at: new Date().toISOString(), kind: "training.start", trainingKey: newId(), walkKey: view.walk?.key });
    router.push("/training");
  };

  return (
    <Screen
      top={
        <>
          <View style={styles.row}>
            {tile("Draußen", today?.walk ?? null, clock)}
            {tile("Gefressen", today?.food ?? null, clock)}
          </View>
          <View style={styles.row}>
            {tile("Pipi", today?.pee ?? null, clock)}
            {tile("Poopoo", today?.poop ?? null, clock)}
          </View>
        </>
      }
      bottom={
        <>
          {view.walk ? (
            <BigButton kind="walk" label={`Runde läuft · ${walkClock(view.walk, now)}`} onPress={() => router.push("/runde")} />
          ) : (
            <BigButton kind="walk" label="🐕 Gassi gehen" onPress={startWalk} />
          )}
          <BigButton kind="food" size="l" label="🥣 Futter geben" onPress={() => setFoodOpen(true)} />
          {view.training ? (
            <BigButton kind="training" size="l" label="Training läuft" onPress={() => router.push("/training")} />
          ) : (
            <BigButton kind="training" size="l" label="🎯 Training starten" onPress={startTraining} />
          )}
          <Sheet open={foodOpen} onClose={() => setFoodOpen(false)}>
            <Text style={[styles.title, { color: theme.ink }]}>Futter geben</Text>
          </Sheet>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
