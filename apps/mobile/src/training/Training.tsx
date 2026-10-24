// The running training: on top the clock and the summary line, at the bottom each shown exercise with "klappt",
// "geht so" (#100) and "klappt nicht" per repetition, "+ Übung" (one of the household's exercises not shown yet, or a new one: "Neue Übung
// …"), the treats with +1, and Fertig. A long press on a button undoes its last tap. With several dogs a tap asks for
// the dog (like Pipi on the walk). Every tap goes through the queue; only a new exercise needs the server.
import { addCounts, type Counts, exerciseRate, type Grade, GRADE_LABEL, GRADES, newId, NO_COUNTS, trainingSummaryLine } from "@gassi/domain";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useWrite } from "../more/useWrite";
import { trainingClock } from "../start/elapsed";
import { useNow } from "../start/useNow";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ChoiceList } from "../ui/ChoiceList";
import { GradeButton } from "../ui/GradeButton";
import { Graded } from "../ui/Graded";
import { ChoiceSheet } from "../ui/ChoiceSheet";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useLeaving } from "../ui/useLeaving";

export function Training() {
  const router = useRouter();
  const theme = useTheme();
  const { view, send, exercises, treatKinds, dogs, online, unsent, refresh } = useGassi();
  const training = view.training;
  const now = useNow(1000);
  // exercises added with "+ Übung" stay shown before their first tap; the others show because they have reps
  const [added, setAdded] = useState<number[]>([]);
  const [picking, setPicking] = useState(false);
  // "Neue Übung …": the name typed in the picker (null: the list of exercises shows)
  const [naming, setNaming] = useState<string | null>(null);
  const { message, setMessage, run } = useWrite();
  // the dog question for a tap, or for an undo when the last tap's dog is not known (`undoDogs`: those with a count)
  const [choosing, setChoosing] = useState<{ exerciseId: number; grade: Grade; undoDogs?: number[] } | null>(null);
  // the dog of the last tap on each "klappt" / "geht so" / "klappt nicht" button of an exercise, so that a long press undoes that very tap; after a
  // reload it is not known, and the undo asks when several dogs have a count
  const lastDog = useRef(new Map<string, number>());

  // Fertig happens once, also on a double tap. Without a training (stopped on another phone) the focused screen goes
  // back to Start.
  const { leave, isLeaving } = useLeaving();
  useFocusEffect(
    useCallback(() => {
      if (!training && !isLeaving()) router.dismissTo("/");
    }, [training, router, isLeaving]),
  );
  if (!training) return null;

  const at = () => new Date().toISOString();
  const trainingKey = training.key;
  const dogIds = training.dogIds;
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  const exerciseName = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Übung";
  const count = (exerciseId: number, dogId: number, grade: Grade) => training.reps.find((x) => x.exerciseId === exerciseId && x.dogId === dogId)?.[grade] ?? 0;
  const totals = (exerciseId: number) => training.reps.filter((r) => r.exerciseId === exerciseId).reduce<Counts>(addCounts, NO_COUNTS);

  const rep = (exerciseId: number, dogId: number, grade: Grade, delta: 1 | -1) => {
    setChoosing(null);
    send({ id: newId(), at: at(), kind: "training.rep", trainingKey, exerciseId, dogId, grade, delta });
  };
  const tap = (exerciseId: number, grade: Grade) => {
    if (dogIds.length > 1) return setChoosing({ exerciseId, grade });
    if (dogIds[0] !== undefined) pick(exerciseId, grade, dogIds[0]);
  };
  const pick = (exerciseId: number, grade: Grade, dogId: number) => {
    lastDog.current.set(`${exerciseId}:${grade}`, dogId);
    rep(exerciseId, dogId, grade, 1);
  };
  const undo = (exerciseId: number, grade: Grade) => {
    const last = lastDog.current.get(`${exerciseId}:${grade}`);
    if (last !== undefined && count(exerciseId, last, grade) > 0) return rep(exerciseId, last, grade, -1);
    const counted = dogIds.filter((d) => count(exerciseId, d, grade) > 0);
    if (counted.length === 1) rep(exerciseId, counted[0] as number, grade, -1);
    else if (counted.length > 1) setChoosing({ exerciseId, grade, undoDogs: counted });
  };
  const treat = (treatKindId: number, delta: 1 | -1) => {
    if (delta === -1 && !training.treats[treatKindId]) return;
    send({ id: newId(), at: at(), kind: "training.treat", trainingKey, treatKindId, delta });
  };
  // back to the walk it was started from, or to Start: dismissTo pops back to that screen (a replace would leave
  // the walk on the stack twice), and replaces this one when it isn't there (a training started from Start)
  const done = () =>
    leave(() => {
      send({ id: newId(), at: at(), kind: "training.stop", trainingKey });
      router.dismissTo(training.walkKey && view.walk?.key === training.walkKey ? "/runde" : "/");
    });

  const shownIds = new Set([...added, ...training.reps.map((r) => r.exerciseId)]);
  const shown = exercises.filter((e) => shownIds.has(e.id));
  const more = exercises.filter((e) => !shownIds.has(e.id));
  const rows = training.reps.map((r) => ({ ...r, name: exerciseName(r.exerciseId) }));
  const treats = Object.values(training.treats).reduce((n, c) => n + c, 0);
  const choosingExercise = choosing ? exerciseName(choosing.exerciseId) : "";
  const openPicker = () => {
    setNaming(null);
    setMessage(null);
    setPicking(true);
  };
  const show = (id: number) => {
    setPicking(false);
    setAdded((a) => [...a, id]);
  };
  // a new exercise is made on the server (without reception it says so); it shows once the lists are fresh
  const create = () => {
    // a name the household has already (in any case) is that exercise: no second one
    const same = exercises.find((e) => e.name.trim().toLocaleLowerCase("de") === (naming ?? "").trim().toLocaleLowerCase("de"));
    if (same) return show(same.id);
    void run(async (api) => {
      const made = await api.addExercise({ name: naming ?? "" });
      await refresh();
      show(made.id);
    });
  };

  return (
    <Screen
      topMin={170}
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
            <Graded testID="training-summary" style={[styles.line, { color: theme.ink }]} text={trainingSummaryLine(rows, treats)} />
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
                  <Graded style={[styles.name, { color: theme.ink }]} text={exerciseRate({ name: e.name, ...t })} />
                  <View style={styles.row}>
                    {GRADES.map((g) => (
                      <View key={g} style={styles.cell}>
                        <GradeButton grade={g} size="m" what={e.name} onPress={() => tap(e.id, g)} onLongPress={() => undo(e.id, g)} />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {shown.length === 0 ? <Text style={[styles.hint, { color: theme.muted }]}>Noch keine Übung – „+ Übung“ wählt eine aus oder legt eine an.</Text> : null}
          </ScrollView>
          {shown.length || treatKinds.length ? <Text style={[styles.hint, { color: theme.muted }]}>Halten = rückgängig</Text> : null}
          <BigButton kind="neutral" size="m" label="+ Übung" a11y="Übung hinzufügen" onPress={openPicker} />
          {treatKinds.length ? (
            <View style={[styles.row, styles.wrap]}>
              {treatKinds.map((k) => (
                <View key={k.id} style={[styles.cell, styles.treat]}>
                  <BigButton kind="food" size="m" icon="treat" label={`${k.name} · ${training.treats[k.id] ?? 0}`} sub="+1" a11y={`${k.name} +1`} onPress={() => treat(k.id, 1)} onLongPress={() => treat(k.id, -1)} />
                </View>
              ))}
            </View>
          ) : null}
          <BigButton kind="training" size="l" icon="check" label="Fertig" onPress={done} />

          <ChoiceSheet
            testID="dog-choice"
            open={choosing !== null}
            title={choosing ? `${choosingExercise} ${GRADE_LABEL[choosing.grade]}${choosing.undoDogs ? " rückgängig" : ""} – welcher Hund?` : ""}
            choices={(choosing?.undoDogs ?? dogIds).map((id) => ({
              key: id,
              label: dogName(id),
              color: dogs.find((d) => d.id === id)?.color,
              onPress: () => choosing && (choosing.undoDogs ? rep(choosing.exerciseId, id, choosing.grade, -1) : pick(choosing.exerciseId, choosing.grade, id)),
            }))}
            onClose={() => setChoosing(null)}
          />
          <Sheet open={picking} onClose={() => setPicking(false)} label={naming === null ? "Welche Übung?" : "Neue Übung"}>
            {naming === null ? (
              <View testID="exercise-picker" style={styles.gap}>
                <Text style={[styles.title, { color: theme.ink }]}>Welche Übung?</Text>
                <ChoiceList choices={[...more.map((e) => ({ key: e.id, label: e.name, onPress: () => show(e.id) })), { key: "new", label: "Neue Übung …", onPress: () => setNaming("") }]} />
              </View>
            ) : (
              <View testID="exercise-new" style={styles.gap}>
                <Text style={[styles.title, { color: theme.ink }]}>Neue Übung</Text>
                <Field label="Name der Übung" value={naming} onChangeText={setNaming} autoFocus onSubmitEditing={create} />
                {message ? (
                  <Text testID="exercise-message" style={[styles.hint, { color: theme.ink }]}>
                    {message}
                  </Text>
                ) : null}
                <BigButton kind="training" size="l" icon="add" label="Anlegen" disabled={!naming.trim()} onPress={create} />
              </View>
            )}
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
  exercises: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  exercise: { borderRadius: radius.tile, padding: 10, gap: 6 },
  name: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 14, textAlign: "center" },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  wrap: { flexWrap: "wrap" },
  treat: { flexBasis: 100 },
  gap: { gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
});
