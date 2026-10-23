// The running walk ("Runde"): one hand holds the leash, the thumb taps. On top the clock, who walks with which dogs
// (a chip taps them off, "+" adds), and what happened so far; at the bottom Pipi, Markiert (for dogs that mark, #38) and
// Poopoo, Kommando, Leckerli and Begegnung (#36, #90, #37), Pause/Weiter and Training, Zuhause; with several dogs on the walk
// each asks which one. A poop is logged at the tap and then asks how it was (#86), in a sheet like the dog's; closed,
// it has none. A poop in the list asks again. Every tap goes through the queue and shows at once. When the walk is over
// (ended here or on another phone), the screen leaves: to the summary after Zuhause, else to Start.
import { CONSISTENCIES, CONSISTENCY_LABEL, type Consistency, keepsOne, newId, TYPE_LABEL } from "@gassi/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { walkClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { type LogStart, Logging } from "../log/LogSheet";
import { ChoiceSheet, dogChoices } from "../ui/ChoiceSheet";
import { Icon } from "../ui/Icon";
import { TYPE_ICON, TYPE_TONE } from "../ui/icons";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useLeaving } from "../ui/useLeaving";
import { saveEnded } from "./ended";
import { LAST_DOG, LAST_WALKER } from "./lastOne";
import { tapLine, trainingLine, walkItems } from "./lines";
import type { Tap } from "./taps";
import { useWalkTaps } from "./useWalkTaps";

type Kind = "pee" | "mark" | "poop";

export function Walk() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send, people, dogs, online, unsent } = useGassi();
  const walk = view.walk;
  const now = useNow(1000);
  const { taps, trainings } = useWalkTaps(walk);
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState<Kind | null>(null);
  const [hint, setHint] = useState<string | null>(null); // why the last person or dog can't be tapped off
  const [asking, setAsking] = useState<Tap | null>(null); // the poop whose consistency is asked
  const [logging, setLogging] = useState<LogStart | null>(null);

  // Leaving (Zuhause, Training) happens once, also on a double tap. Without a walk (ended on another phone, or none
  // after a reload) the focused screen goes back to Start, down its tab's stack.
  const { leave, isLeaving } = useLeaving();
  useFocusEffect(
    useCallback(() => {
      if (!walk && !isLeaving()) router.dismissTo("/");
    }, [walk, router, isLeaving]),
  );
  if (!walk) return null;

  const at = () => new Date().toISOString();
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  const walkDogs = walk.dogIds;
  const several = walkDogs.length > 1;
  // a tap's dog, named when several dogs walk
  const tapDog = (t: Tap) => (several && t.dogId !== null ? dogName(t.dogId) : null);
  // the button shows when a dog on the walk marks; which dog marked is asked like for Pipi
  const marking = walkDogs.some((id) => dogs.find((d) => d.id === id)?.marks);

  const log = (type: Kind, dogId: number) => {
    setChoosing(null);
    const time = at();
    send({ id: newId(), at: time, kind: "log", type, dogId });
    if (type === "poop") setAsking({ type, at: time, dogId });
  };
  const tap = (type: Kind) => (several ? setChoosing(type) : walkDogs[0] !== undefined && log(type, walkDogs[0]));
  const consistency = (poop: Tap, c: Consistency | null) => {
    setAsking(null);
    if (poop.dogId === null) return; // a poop always has its dog
    send({
      id: newId(),
      at: at(),
      kind: "log.consistency",
      poopAt: poop.at,
      dogId: poop.dogId,
      consistency: c,
    });
  };
  const pause = () => {
    send({
      id: newId(),
      at: at(),
      kind: walk.paused ? "walk.resume" : "walk.pause",
      walkKey: walk.key,
    });
  };
  const training = () =>
    leave(() => {
      if (!view.training)
        send({
          id: newId(),
          at: at(),
          kind: "training.start",
          trainingKey: newId(),
          walkKey: walk.key,
          dogIds: walk.dogIds.length ? walk.dogIds : undefined,
        });
      router.push("/training");
    });
  const home = () =>
    leave(() => {
      const end = at();
      saveEnded({
        key: walk.key,
        startedAt: walk.startedAt,
        endedAt: end,
        pauses: walk.pauses,
        walkers: walk.walkers,
        dogIds: walkDogs,
        taps,
      });
      send({ id: newId(), at: end, kind: "walk.stop", walkKey: walk.key });
      router.replace(`/runde/${walk.key}`);
    });
  const walkerIds = walk.walkers.map((w) => w.id);
  const walker = (personId: string, on: boolean) => {
    setAdding(false);
    if (!on && !keepsOne(walkerIds, personId)) return setHint(LAST_WALKER);
    setHint(null);
    send({
      id: newId(),
      at: at(),
      kind: "walk.walker",
      walkKey: walk.key,
      personId,
      on,
    });
  };
  const dog = (dogId: number, on: boolean) => {
    setAdding(false);
    if (!on && !keepsOne(walkDogs, dogId)) return setHint(LAST_DOG);
    setHint(null);
    send({
      id: newId(),
      at: at(),
      kind: "walk.dog",
      walkKey: walk.key,
      dogId,
      on,
    });
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
              <Chip key={p.id} label={p.name} a11y={keepsOne(walkerIds, p.id) ? `${p.name} entfernen` : `${p.name}, bleibt dabei`} onPress={() => walker(p.id, false)} />
            ))}
            {walk.dogIds.map((id) => (
              <Chip key={id} label={dogName(id)} color={dogs.find((d) => d.id === id)?.color} a11y={keepsOne(walkDogs, id) ? `${dogName(id)} entfernen` : `${dogName(id)}, bleibt dabei`} onPress={() => dog(id, false)} />
            ))}
            <Chip label="+" a11y="Hinzufügen" on={false} onPress={() => setAdding(true)} />
          </View>
          {hint ? <Text style={[styles.since, { color: theme.muted }]}>{hint}</Text> : null}
          {walkDogs.length === 0 ? <Text style={[styles.since, { color: theme.muted }]}>Kein Hund dabei – „+“ nimmt einen mit.</Text> : null}
          <View testID="walk-taps" style={[styles.log, { backgroundColor: theme.surface }]}>
            {taps.length === 0 && trainings.length === 0 && !runningTraining ? <Text style={[styles.line, { color: theme.muted }]}>Noch nichts</Text> : null}
            {walkItems(taps, trainings).map((item, i) =>
              item.kind === "tap" ? (
                <Pressable
                  key={`${item.tap.type}${item.at}${item.tap.dogId}`}
                  disabled={item.tap.type !== "poop"}
                  accessibilityRole={item.tap.type === "poop" ? "button" : undefined}
                  accessibilityLabel={`${tapLine(item.tap, tapDog(item.tap))}, ${hhmm(item.at)}${item.tap.type === "poop" ? ", Konsistenz wählen" : ""}`}
                  onPress={() => setAsking(item.tap)}
                  style={styles.item}
                >
                  <Text style={[styles.line, styles.time, { color: theme.muted }]}>{hhmm(item.at)}</Text>
                  <Icon name={TYPE_ICON[item.tap.type]} size={17} color={theme[TYPE_TONE[item.tap.type]]} />
                  <Text style={[styles.line, styles.shrink, { color: theme.ink }]} numberOfLines={1}>
                    {tapLine(item.tap, tapDog(item.tap))}
                  </Text>
                </Pressable>
              ) : (
                <View key={`t${i}`} style={styles.item}>
                  <Text style={[styles.line, styles.time, { color: theme.muted }]}>{hhmm(item.at)}</Text>
                  <Icon name="training" size={17} color={theme.training} />
                  <Text style={[styles.line, styles.shrink, { color: theme.ink }]}>{trainingLine(item.training)}</Text>
                </View>
              ),
            )}
            {runningTraining && trainings.length === 0 ? (
              <View style={styles.item}>
                <Icon name="training" size={17} color={theme.training} />
                <Text style={[styles.line, { color: theme.ink }]}>Training läuft</Text>
              </View>
            ) : null}
          </View>
        </>
      }
      bottom={
        <>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="pee" icon="pee" label={TYPE_LABEL.pee} stacked={marking} disabled={walkDogs.length === 0} onPress={() => tap("pee")} />
            </View>
            {marking ? (
              <View style={styles.cell}>
                <BigButton kind="pee" icon="mark" label={TYPE_LABEL.mark} stacked={marking} onPress={() => tap("mark")} />
              </View>
            ) : null}
            <View style={styles.cell}>
              <BigButton kind="poop" icon="poop" label={TYPE_LABEL.poop} stacked={marking} disabled={walkDogs.length === 0} onPress={() => tap("poop")} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="training" size="m" icon="training" label="Kommando" stacked disabled={walkDogs.length === 0} onPress={() => setLogging("command")} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="training" size="m" icon="treat" label="Leckerli" stacked disabled={walkDogs.length === 0} onPress={() => setLogging("treat")} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="encounter" size="m" icon="people" label="Begegnung" stacked disabled={walkDogs.length === 0} onPress={() => setLogging("encounter")} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <BigButton kind="neutral" size="m" icon={walk.paused ? "resume" : "pause"} label={walk.paused ? "Weiter" : "Pause"} onPress={pause} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="training" size="m" icon="training" label={runningTraining ? "Training läuft" : "Training"} onPress={training} />
            </View>
          </View>
          <BigButton kind="walk" size="l" icon="home" label="Zuhause" onPress={home} />

          <Logging start={logging} dogIds={walkDogs} place="outside" onDone={() => setLogging(null)} />
          <ChoiceSheet
            testID="dog-choice"
            open={choosing !== null}
            title={choosing ? `${TYPE_LABEL[choosing]} – welcher Hund?` : ""}
            choices={dogChoices(walkDogs, dogs, (id) => choosing && log(choosing, id))}
            onClose={() => setChoosing(null)}
          />
          <ChoiceSheet
            testID="consistency-choice"
            open={asking !== null}
            title={`${asking ? tapLine({ ...asking, consistency: null }, tapDog(asking)) : ""} – wie war's?`}
            accent={theme.poop}
            choices={CONSISTENCIES.map((c) => {
              const shown = asking && taps.find((t) => t.type === "poop" && t.at === asking.at && t.dogId === asking.dogId);
              const on = shown?.consistency === c;
              return {
                key: c,
                label: CONSISTENCY_LABEL[c],
                on,
                onPress: () => asking && consistency(asking, on ? null : c),
              };
            })}
            onClose={() => setAsking(null)}
          />
          <Sheet open={adding} onClose={() => setAdding(false)} label="Wer kommt mit?">
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
  clock: {
    fontSize: 56,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  since: { fontSize: 14, textAlign: "center" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginVertical: 4,
  },
  log: { borderRadius: 12, padding: 12, gap: 4 },
  line: { fontSize: 15 },
  item: { flexDirection: "row", alignItems: "center", gap: 8 },
  time: { fontVariant: ["tabular-nums"], minWidth: 40 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  sheet: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
