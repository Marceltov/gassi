// The running walk ("Runde"): one hand holds the leash, the thumb taps. On top the clock, who walks with which dogs
// (a chip taps them off, "+" adds), the route in one line (the distance on the phone that records it, a tap shows it,
// #104), and what happened so far; at the bottom Pipi, Markiert (for dogs that mark, #38) and
// Poopoo, Kommando, Leckerli and Begegnung (#36, #90, #37), Pause/Weiter and Training, Zuhause; with several dogs on the walk
// each asks which one. Only what happened scrolls, newest first; a tap on one opens it to change or delete (#99). A tap on Kommando or Leckerli logs the usual one they name, a hold chooses (#98). A poop is logged at the tap and then asks how it was (#86), in a sheet like the dog's; closed,
// it has none; one still in the queue asks again from the list. Every tap goes through the queue and shows at once. When the walk is over
// (ended here or on another phone), the screen leaves: to the summary after Zuhause, else to Start. On Android, the first
// walk this phone records opens Akku once (#108), and a recording Android ended behind the app's back is said under
// the route, with the way to Akku.
import { CONSISTENCIES, CONSISTENCY_LABEL, type Consistency, keepsOne, newId, TYPE_LABEL } from "@gassi/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { walkClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { type LogStart, Logging, useQuickLines } from "../log/LogSheet";
import { ChoiceSheet, dogChoices } from "../ui/ChoiceSheet";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useLeaving } from "../ui/useLeaving";
import { saveEnded } from "./ended";
import { LAST_DOG, LAST_WALKER } from "./lastOne";
import { tapLine, trainingLine, walkItems } from "./lines";
import type { Tap } from "./taps";
import { useWalkTaps } from "./useWalkTaps";
import { ItemRow } from "./ItemRow";
import { RoutePill } from "./RoutePill";
import { RouteSheet } from "./RouteSheet";
import { useTabPath } from "../ui/tabPath";
import { takeFirstRecording } from "../track/firstRecording";
import { hintsSupported } from "../track/hints";
import { useRecording } from "../track/Recording";

type Kind = "pee" | "mark" | "poop";

export function Walk() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send, people, dogs, online, unsent } = useGassi();
  const walk = view.walk;
  const now = useNow(1000);
  const tabPath = useTabPath();
  const { taps, trainings } = useWalkTaps(walk);
  const [adding, setAdding] = useState(false);
  const [route, setRoute] = useState(false);
  const [choosing, setChoosing] = useState<Kind | null>(null);
  const [hint, setHint] = useState<string | null>(null); // why the last person or dog can't be tapped off
  const [asking, setAsking] = useState<Tap | null>(null); // the poop whose consistency is asked
  const [logging, setLogging] = useState<LogStart | null>(null);
  const [quick, setQuick] = useState(false);
  const usual = useQuickLines();

  // Leaving (Zuhause, Training) happens once, also on a double tap. Without a walk (ended on another phone, or none
  // after a reload) the focused screen goes back to Start, down its tab's stack.
  const { leave, isLeaving } = useLeaving();
  useFocusEffect(
    useCallback(() => {
      if (!walk && !isLeaving()) router.dismissTo("/");
    }, [walk, router, isLeaving]),
  );
  const { mine, stoppedEarly } = useRecording();
  useEffect(() => {
    if (mine && hintsSupported() && takeFirstRecording()) router.push("/mehr/akku");
  }, [mine, router]);
  if (!walk) return null;

  const at = () => new Date().toISOString();
  // a tap logs the usual (without one yet it asks), a hold asks
  const start = (s: LogStart, fast: boolean) => {
    setQuick(fast);
    setLogging(s);
  };
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
      head={
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
          <RoutePill onPress={() => setRoute(true)} />
          {stoppedEarly ? (
            <Pressable testID="recording-stopped" accessibilityRole="button" onPress={() => router.push("/mehr/akku")}>
              <Text style={[styles.since, { color: theme.warn }]}>Android hat die Aufnahme beendet · Akku ›</Text>
            </Pressable>
          ) : null}
          {hint ? <Text style={[styles.since, { color: theme.muted }]}>{hint}</Text> : null}
          {walkDogs.length === 0 ? <Text style={[styles.since, { color: theme.muted }]}>Kein Hund dabei – „+“ nimmt einen mit.</Text> : null}
        </>
      }
      top={
        <View testID="walk-taps" style={[styles.log, { backgroundColor: theme.surface }]}>
          {taps.length === 0 && trainings.length === 0 && !runningTraining ? <Text style={[styles.line, { color: theme.muted }]}>Noch nichts</Text> : null}
          {runningTraining && trainings.length === 0 ? (
            <View style={styles.item}>
              <Icon name="training" size={17} color={theme.training} />
              <Text style={[styles.line, { color: theme.ink }]}>Training läuft</Text>
            </View>
          ) : null}
          {walkItems(taps, trainings)
            .reverse()
            .map((item) => {
              const text = item.kind === "tap" ? tapLine(item.tap, tapDog(item.tap)) : trainingLine(item.training);
              const key = `${item.kind}${item.at}${item.kind === "tap" ? item.tap.dogId : ""}`;
              const id = item.kind === "tap" ? item.tap.id : item.training.id;
              // one the server has opens its entry; a poop still in the queue asks how it was
              if (id !== undefined) return <ItemRow key={key} item={item} text={text} compact onPress={() => router.push(tabPath(`/eintrag/${id}`))} />;
              if (item.kind === "tap" && item.tap.type === "poop") {
                const poop = item.tap;
                return <ItemRow key={key} item={item} text={text} compact a11y={`${text}, ${hhmm(item.at)}, Konsistenz wählen`} onPress={() => setAsking(poop)} />;
              }
              return <ItemRow key={key} item={item} text={text} compact />;
            })}
        </View>
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
              <BigButton kind="training" size="l" icon="training" label="Kommando" sub={usual.command} stacked disabled={walkDogs.length === 0} onPress={() => start("command", true)} onLongPress={() => start("command", false)} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="training" size="l" icon="treat" label="Leckerli" sub={usual.treat} stacked disabled={walkDogs.length === 0} onPress={() => start("treat", true)} onLongPress={() => start("treat", false)} />
            </View>
            <View style={styles.cell}>
              <BigButton kind="encounter" size="l" icon="people" label="Begegnung" stacked disabled={walkDogs.length === 0} onPress={() => start("encounter", false)} />
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

          <Logging start={logging} quick={quick} dogIds={walkDogs} place="outside" onDone={() => setLogging(null)} />
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
          <RouteSheet walk={walk} open={route} onClose={() => setRoute(false)} />
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
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  sheet: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
