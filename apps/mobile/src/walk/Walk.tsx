// The running walk ("Runde"): one hand holds the leash, the thumb taps. On top the clock, who walks with which dogs
// (a chip taps them off, "+" adds), and what happened so far; at the bottom Pipi and Poopoo, Pause/Weiter and Training,
// Zuhause. Every tap goes through the queue and shows at once. When the walk is over (ended here or on another phone),
// the screen leaves: to the summary after Zuhause, else to Start.
import { newId } from "@gassi/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { walkClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { saveEnded } from "./ended";
import { trainingLine } from "./lines";
import { useWalkTaps } from "./useWalkTaps";

type Kind = "pee" | "poop";
const LABEL: Record<Kind, string> = { pee: "💧 Pipi", poop: "💩 Poopoo" };

export function Walk() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send, people, dogs, online, unsent } = useGassi();
  const walk = view.walk;
  const now = useNow(1000);
  const { taps, trainings } = useWalkTaps(walk);
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState<Kind | null>(null);

  // Leaving (Zuhause, Training) happens once, also on a double tap. Without a walk (ended on another phone, or none
  // after a reload) the focused screen goes back to Start.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      if (!walk && !leaving.current) router.replace("/");
    }, [walk, router]),
  );
  if (!walk) return null;

  const at = () => new Date().toISOString();
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  // a walk the server hasn't answered for yet may list no dogs: then every dog the phone knows
  const walkDogs = walk.dogIds.length ? walk.dogIds : dogs.filter((d) => !d.archived).map((d) => d.id);
  const several = walkDogs.length > 1;

  const log = (type: Kind, dogId: number) => {
    setChoosing(null);
    send({ id: newId(), at: at(), kind: "log", type, dogId });
  };
  const tap = (type: Kind) => (several ? setChoosing(type) : walkDogs[0] !== undefined && log(type, walkDogs[0]));
  const pause = () => send({ id: newId(), at: at(), kind: walk.paused ? "walk.resume" : "walk.pause", walkKey: walk.key });
  const training = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (!view.training) send({ id: newId(), at: at(), kind: "training.start", trainingKey: newId(), walkKey: walk.key, dogIds: walk.dogIds.length ? walk.dogIds : undefined });
    router.push("/training");
  };
  const home = () => {
    if (leaving.current) return;
    leaving.current = true;
    const end = at();
    saveEnded({ key: walk.key, startedAt: walk.startedAt, endedAt: end, pauses: walk.pauses, walkers: walk.walkers, dogIds: walkDogs, taps });
    send({ id: newId(), at: end, kind: "walk.stop", walkKey: walk.key });
    router.replace(`/runde/${walk.key}`);
  };
  const walker = (personId: string, on: boolean) => {
    setAdding(false);
    send({ id: newId(), at: at(), kind: "walk.walker", walkKey: walk.key, personId, on });
  };
  const dog = (dogId: number, on: boolean) => {
    setAdding(false);
    send({ id: newId(), at: at(), kind: "walk.dog", walkKey: walk.key, dogId, on });
  };

  const otherPeople = people.filter((p) => !walk.walkers.some((w) => w.id === p.id));
  const otherDogs = dogs.filter((d) => !d.archived && !walk.dogIds.includes(d.id));
  const runningTraining = view.training?.walkKey === walk.key;

  return (
    <Screen
      top={
        <>
          <Text style={[styles.state, { color: theme.muted }]}>
            {walk.paused ? "Pause" : "Runde läuft"}
            {!online && unsent ? ` · ohne Empfang, ${unsent} warten` : ""}
          </Text>
          <Text testID="walk-clock" style={[styles.clock, { color: theme.ink }]}>
            {walkClock(walk, now)}
          </Text>
          <Text style={[styles.since, { color: theme.muted }]}>{`seit ${hhmm(walk.startedAt)}`}</Text>
          <View style={styles.chips}>
            {walk.walkers.map((p) => (
              <Chip key={p.id} label={p.name} a11y={`${p.name} entfernen`} onPress={() => walker(p.id, false)} />
            ))}
            {walk.dogIds.map((id) => (
              <Chip key={id} label={dogName(id)} color={dogs.find((d) => d.id === id)?.color} a11y={`${dogName(id)} entfernen`} onPress={() => dog(id, false)} />
            ))}
            <Chip label="+" a11y="Hinzufügen" on={false} onPress={() => setAdding(true)} />
          </View>
          <View testID="walk-taps" style={[styles.log, { backgroundColor: theme.surface }]}>
            {taps.length === 0 && trainings.length === 0 && !runningTraining ? <Text style={[styles.line, { color: theme.muted }]}>Noch nichts</Text> : null}
            {taps.map((t) => (
              <Text key={`${t.type}${t.at}${t.dogId}`} style={[styles.line, { color: theme.ink }]}>
                {`${hhmm(t.at)}  ${LABEL[t.type]}${several ? ` · ${dogName(t.dogId)}` : ""}`}
              </Text>
            ))}
            {trainings.map((t, i) => (
              <Text key={`t${i}`} style={[styles.line, { color: theme.ink }]}>
                {trainingLine(t)}
              </Text>
            ))}
            {runningTraining && trainings.length === 0 ? <Text style={[styles.line, { color: theme.ink }]}>🎯 Training läuft</Text> : null}
          </View>
        </>
      }
      bottom={
        <>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="pee" label={LABEL.pee} onPress={() => tap("pee")} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="poop" label={LABEL.poop} onPress={() => tap("poop")} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="neutral" size="m" label={walk.paused ? "▶ Weiter" : "⏸ Pause"} onPress={pause} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="training" size="m" label={runningTraining ? "🎯 Training läuft" : "🎯 Training"} onPress={training} />
            </View>
          </View>
          <BigButton kind="walk" size="l" label="🏠 Zuhause" onPress={home} />

          <Sheet open={choosing !== null} onClose={() => setChoosing(null)}>
            <View testID="dog-choice" style={styles.sheet}>
              <Text style={[styles.title, { color: theme.ink }]}>{choosing ? `${LABEL[choosing]} – welcher Hund?` : ""}</Text>
              {walkDogs.map((id) => (
                <BigButton key={id} kind={choosing ?? "pee"} size="l" label={dogName(id)} onPress={() => choosing && log(choosing, id)} />
              ))}
            </View>
          </Sheet>
          <Sheet open={adding} onClose={() => setAdding(false)}>
            <View style={styles.sheet}>
              <Text style={[styles.title, { color: theme.ink }]}>Wer kommt mit?</Text>
              {otherPeople.length || otherDogs.length ? (
                <View style={styles.chips}>
                  {otherPeople.map((p) => (
                    <Chip key={p.id} label={p.name} on={false} onPress={() => walker(p.id, true)} />
                  ))}
                  {otherDogs.map((d) => (
                    <Chip key={d.id} label={d.name} color={d.color} on={false} onPress={() => dog(d.id, true)} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.line, { color: theme.muted }]}>Alle sind schon dabei.</Text>
              )}
            </View>
          </Sheet>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  state: { fontSize: 13, textAlign: "center" },
  clock: { fontSize: 56, fontWeight: "700", textAlign: "center", fontVariant: ["tabular-nums"] },
  since: { fontSize: 14, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginVertical: 4 },
  log: { borderRadius: 12, padding: 12, gap: 4 },
  line: { fontSize: 15 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  sheet: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
