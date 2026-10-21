// The running training: on top the clock and the summary line, at the bottom each shown exercise with ✓ klappt /
// ✗ klappt nicht per repetition, "+ Übung", the treats with +1, and Fertig. A long press on a button undoes its last
// tap. With several dogs a tap asks for the dog (like Pipi on the walk). Every tap goes through the queue.
import { newId, trainingSummaryLine } from "@gassi/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { trainingClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { DogChoiceSheet } from "../ui/DogChoiceSheet";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";

export function Training() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send, exercises, treatKinds, dogs, online, unsent } = useGassi();
  const training = view.training;
  const now = useNow(1000);
  // exercises added with "+ Übung" stay shown before their first tap; the others show because they have reps
  const [added, setAdded] = useState<number[]>([]);
  const [picking, setPicking] = useState(false);
  const [choosing, setChoosing] = useState<{ exerciseId: number; ok: boolean } | null>(null);
  // the dog of the last tap on each ✓/✗, so that a long press undoes that very tap
  const lastDog = useRef(new Map<string, number>());

  // Fertig happens once, also on a double tap. Without a training (stopped on another phone) the focused screen goes
  // back to Start.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      if (!training && !leaving.current) router.replace("/");
    }, [training, router]),
  );
  if (!training) return null;

  const at = () => new Date().toISOString();
  const trainingKey = training.key;
  const dogIds = training.dogIds.length ? training.dogIds : dogs.filter((d) => !d.archived).map((d) => d.id);
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  const exerciseName = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Übung";
  const count = (exerciseId: number, dogId: number, ok: boolean) => {
    const r = training.reps.find((x) => x.exerciseId === exerciseId && x.dogId === dogId);
    return (ok ? r?.ok : r?.fail) ?? 0;
  };
  const totals = (exerciseId: number) => {
    const rs = training.reps.filter((r) => r.exerciseId === exerciseId);
    return { ok: rs.reduce((n, r) => n + r.ok, 0), fail: rs.reduce((n, r) => n + r.fail, 0) };
  };

  const rep = (exerciseId: number, dogId: number, ok: boolean, delta: 1 | -1) => {
    setChoosing(null);
    send({ id: newId(), at: at(), kind: "training.rep", trainingKey, exerciseId, dogId, ok, delta });
  };
  const tap = (exerciseId: number, ok: boolean) => {
    if (dogIds.length > 1) return setChoosing({ exerciseId, ok });
    if (dogIds[0] !== undefined) pick(exerciseId, ok, dogIds[0]);
  };
  const pick = (exerciseId: number, ok: boolean, dogId: number) => {
    lastDog.current.set(`${exerciseId}:${ok}`, dogId);
    rep(exerciseId, dogId, ok, 1);
  };
  const undo = (exerciseId: number, ok: boolean) => {
    const last = lastDog.current.get(`${exerciseId}:${ok}`);
    const dogId = last !== undefined && count(exerciseId, last, ok) > 0 ? last : dogIds.find((d) => count(exerciseId, d, ok) > 0);
    if (dogId !== undefined) rep(exerciseId, dogId, ok, -1);
  };
  const treat = (treatKindId: number, delta: 1 | -1) => {
    if (delta === -1 && !training.treats[treatKindId]) return;
    send({ id: newId(), at: at(), kind: "training.treat", trainingKey, treatKindId, delta });
  };
  const done = () => {
    if (leaving.current) return;
    leaving.current = true;
    send({ id: newId(), at: at(), kind: "training.stop", trainingKey });
    router.replace(training.walkKey && view.walk?.key === training.walkKey ? "/runde" : "/");
  };

  const shownIds = new Set([...added, ...training.reps.map((r) => r.exerciseId)]);
  const shown = exercises.filter((e) => shownIds.has(e.id));
  const more = exercises.filter((e) => !shownIds.has(e.id));
  const rows = training.reps.map((r) => ({ name: exerciseName(r.exerciseId), ok: r.ok, fail: r.fail }));
  const treats = Object.values(training.treats).reduce((n, c) => n + c, 0);
  const choosingExercise = choosing ? exerciseName(choosing.exerciseId) : "";

  return (
    <Screen
      top={
        <>
          <Text style={[styles.state, { color: theme.muted }]}>
            {"Training läuft"}
            {!online && unsent ? ` · ohne Empfang, ${unsent} warten` : ""}
          </Text>
          <Text testID="training-clock" style={[styles.clock, { color: theme.ink }]}>
            {trainingClock(training, now)}
          </Text>
          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <Text testID="training-summary" style={[styles.line, { color: theme.ink }]}>
              {trainingSummaryLine(rows, treats)}
            </Text>
          </View>
        </>
      }
      bottom={
        <>
          <ScrollView style={styles.exercises} contentContainerStyle={styles.gap}>
            {shown.map((e) => {
              const t = totals(e.id);
              return (
                <View key={e.id} style={[styles.exercise, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.name, { color: theme.ink }]}>{`${e.name} · ${t.ok}/${t.ok + t.fail}`}</Text>
                  <View style={styles.row}>
                    <View style={styles.cell}>
                      <BigButton kind="walk" size="m" label="✓ klappt" a11y={`${e.name} klappt`} onPress={() => tap(e.id, true)} onLongPress={() => undo(e.id, true)} />
                    </View>
                    <View style={styles.cell}>
                      <BigButton kind="neutral" size="m" label="✗ klappt nicht" a11y={`${e.name} klappt nicht`} onPress={() => tap(e.id, false)} onLongPress={() => undo(e.id, false)} />
                    </View>
                  </View>
                </View>
              );
            })}
            {shown.length === 0 ? <Text style={[styles.hint, { color: theme.muted }]}>Noch keine Übung – „+ Übung“ wählt eine aus.</Text> : null}
          </ScrollView>
          {more.length ? <BigButton kind="neutral" size="m" label="+ Übung" a11y="Übung hinzufügen" onPress={() => setPicking(true)} /> : null}
          {treatKinds.length ? (
            <View style={styles.row}>
              {treatKinds.map((k) => (
                <View key={k.id} style={styles.cell}>
                  <BigButton kind="food" size="m" label={`${k.name} · ${training.treats[k.id] ?? 0}`} sub="+1" a11y={`${k.name} +1`} onPress={() => treat(k.id, 1)} onLongPress={() => treat(k.id, -1)} />
                </View>
              ))}
            </View>
          ) : null}
          <BigButton kind="training" size="l" label="✓ Fertig" onPress={done} />

          <DogChoiceSheet
            open={choosing !== null}
            title={choosing ? `${choosingExercise} ${choosing.ok ? "klappt" : "klappt nicht"} – welcher Hund?` : ""}
            kind={choosing?.ok === false ? "neutral" : "walk"}
            dogs={dogIds.map((id) => ({ id, name: dogName(id) }))}
            onPick={(id) => choosing && pick(choosing.exerciseId, choosing.ok, id)}
            onClose={() => setChoosing(null)}
          />
          <Sheet open={picking} onClose={() => setPicking(false)}>
            <View style={styles.gap}>
              <Text style={[styles.title, { color: theme.ink }]}>Welche Übung?</Text>
              {more.map((e) => (
                <BigButton
                  key={e.id}
                  kind="training"
                  size="l"
                  label={e.name}
                  onPress={() => {
                    setPicking(false);
                    setAdded((a) => [...a, e.id]);
                  }}
                />
              ))}
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
  summary: { borderRadius: radius.tile, padding: 12 },
  line: { fontSize: 16, textAlign: "center" },
  exercises: { maxHeight: 320, flexGrow: 0 },
  exercise: { borderRadius: radius.tile, padding: 10, gap: 6 },
  name: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 14, textAlign: "center" },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  gap: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
