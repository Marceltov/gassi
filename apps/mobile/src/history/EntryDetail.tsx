// One entry from Verlauf, to be put right afterwards: its time (and end), the dogs, for a walk who went, for food the
// amount and kind, for weight the weight, for a training its repetitions per exercise and dog and its treats, a note;
// Speichern sends it all, Löschen asks first. Both need the server and say so without reception.
import { clampPortion, dogRule, FOOD_MAX_G, type FoodKind, formatKg, keepsOne, trainingSummaryLine, TYPE_LABEL } from "@gassi/domain";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { errorMessage } from "../data/api";
import { type Gassi, useGassi } from "../data/GassiProvider";
import { type ButtonKind, radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { TYPE_ICON } from "./EntryRow";
import { bumpRep, bumpTreat, editInput, type Entry, type Form, formOf, pickDog, trainingInput } from "./form";
import { TimeField } from "./TimeField";

const KINDS: { kind: FoodKind; label: string }[] = [
  { kind: "wet", label: "Nass" },
  { kind: "dry", label: "Trocken" },
];
const BUTTON: Partial<Record<Entry["type"], ButtonKind>> = { walk: "walk", food: "food", training: "training", pee: "pee", poop: "poop" };

export function EntryDetail({ id }: { id: number }) {
  const router = useRouter();
  const theme = useTheme();
  const { api, people, dogs, exercises, treatKinds } = useGassi();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const busy = useRef(false); // a second tap on Speichern or Löschen while the first is on its way does nothing

  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.entry({ id }).then(
      (e) => {
        if (!alive) return;
        setEntry(e);
        setForm(formOf(e));
      },
      (e) => alive && setMessage(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [api, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/verlauf"));
  const run = async (call: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await call();
      back();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      busy.current = false;
    }
  };
  const save = (e: Entry, f: Form) =>
    run(async () => {
      if (!api) return;
      await api.editEntry(editInput(e, f));
      if (e.type === "training") await api.editTraining(trainingInput(e, f));
    });
  const remove = () =>
    run(async () => {
      setAsking(false);
      if (api) await api.deleteEntry({ id });
    });

  if (!entry || !form) {
    const waitText = <Text style={[styles.small, { color: theme.muted }]}>{message ?? "Lädt …"}</Text>;
    return <Screen top={waitText} bottom={<BigButton kind="neutral" size="l" label="Zurück" onPress={back} />} />;
  }

  const change = (c: Partial<Form>) => setForm({ ...form, ...c });
  const rule = dogRule(entry.type);
  const shownDogs = dogs.filter((d) => !d.archived || entry.dogIds.includes(d.id));
  const everyone = [...people, ...entry.walkerIds.flatMap((w, i) => (people.some((p) => p.id === w) ? [] : [{ id: w, name: entry.walkers[i] ?? w }]))];
  const toggleWalker = (pid: string) => {
    if (!form.walkerIds.includes(pid)) change({ walkerIds: [...form.walkerIds, pid] });
    else if (keepsOne(form.walkerIds, pid)) change({ walkerIds: form.walkerIds.filter((w) => w !== pid) });
  };
  const running = !!entry.clientKey && !entry.endedAt;
  const timed = entry.type === "walk" || entry.type === "training";

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>{`${TYPE_ICON[entry.type]} ${TYPE_LABEL[entry.type]}`}</Text>
          <Text style={[styles.small, { color: theme.muted }]}>{`eingetragen von ${entry.byName}`}</Text>
          <View style={styles.times}>
            <TimeField label={timed ? "Beginn" : "Zeit"} value={form.at} onChange={(at) => change({ at })} />
            {form.endedAt !== null ? <TimeField label="Ende" value={form.endedAt} onChange={(endedAt) => change({ endedAt })} /> : null}
          </View>
          {running ? <Text style={[styles.small, { color: theme.muted }]}>Läuft noch.</Text> : null}

          {entry.type === "food" ? (
            <>
              <View style={[styles.switch, { borderColor: theme.line }]}>
                {KINDS.map((k) => (
                  <Pressable
                    key={k.kind}
                    accessibilityRole="tab"
                    accessibilityLabel={k.label}
                    aria-selected={form.foodKind === k.kind}
                    onPress={() => change({ foodKind: k.kind })}
                    style={[styles.segment, form.foodKind === k.kind && { backgroundColor: theme.food }]}
                  >
                    <Text style={[styles.segmentText, { color: form.foodKind === k.kind ? "#fff" : theme.muted }]}>{k.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Amount value={`${form.amountG ?? 0} g`} step="10 g" onStep={(d) => change({ amountG: clampPortion((form.amountG ?? 0) + d * 10) })} min={(form.amountG ?? 0) <= 1} max={(form.amountG ?? 0) >= FOOD_MAX_G} />
            </>
          ) : null}
          {entry.type === "weight" ? <Amount value={formatKg(form.amountG ?? 0)} step="100 g" onStep={(d) => change({ amountG: Math.max(100, (form.amountG ?? 0) + d * 100) })} min={(form.amountG ?? 0) <= 100} max={false} /> : null}

          {rule !== "none" && shownDogs.length > 1 ? (
            <Group label={rule === "one" ? "Hund" : "Hunde"}>
              {shownDogs.map((d) => (
                <Chip key={d.id} label={d.name} color={d.color} on={form.dogIds.includes(d.id)} onPress={() => change({ dogIds: pickDog(entry.type, form.dogIds, d.id) })} />
              ))}
            </Group>
          ) : null}
          {entry.type === "walk" ? (
            <Group label="Wer war dabei">
              {everyone.map((p) => (
                <Chip key={p.id} label={p.name} on={form.walkerIds.includes(p.id)} onPress={() => toggleWalker(p.id)} />
              ))}
            </Group>
          ) : null}
          {entry.type === "training" ? <TrainingFields form={form} change={change} names={{ dogs, exercises, treatKinds }} /> : null}

          <TextInput
            value={form.note}
            onChangeText={(note) => change({ note })}
            placeholder="Notiz"
            placeholderTextColor={theme.muted}
            multiline
            style={[styles.note, { color: theme.ink, backgroundColor: theme.surface }]}
          />
          {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
          <Sheet open={asking} onClose={() => setAsking(false)}>
            <View testID="delete-sheet" style={styles.sheet}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Eintrag löschen?</Text>
              <Text style={[styles.small, { color: theme.muted }]}>{`${TYPE_LABEL[entry.type]} – das lässt sich nicht rückgängig machen.`}</Text>
              <BigButton kind="neutral" size="l" label="Ja, löschen" onPress={() => void remove()} />
              <BigButton kind="neutral" size="m" label="Abbrechen" onPress={() => setAsking(false)} />
            </View>
          </Sheet>
        </>
      }
      bottom={
        <>
          <BigButton kind={BUTTON[entry.type] ?? "neutral"} size="l" label="Speichern" onPress={() => void save(entry, form)} />
          <View style={styles.pair}>
            <View style={styles.half}>
              <BigButton kind="neutral" size="m" label="Zurück" onPress={back} />
            </View>
            <View style={styles.half}>
              <BigButton kind="neutral" size="m" label="Löschen" onPress={() => setAsking(true)} />
            </View>
          </View>
        </>
      }
    />
  );
}

type Names = Pick<Gassi, "dogs" | "exercises" | "treatKinds">;

// A training's repetitions per exercise (and dog, when several train) as ✓ and ✗ counts, more exercises from the
// household's list, and the treats per kind.
function TrainingFields({ form, change, names }: { form: Form; change: (c: Partial<Form>) => void; names: Names }) {
  const theme = useTheme();
  const reps = form.reps.filter((r) => form.dogIds.includes(r.dogId));
  const exerciseIds = [...new Set(reps.map((r) => r.exerciseId))];
  const exerciseName = (eid: number) => names.exercises.find((x) => x.id === eid)?.name ?? "Übung";
  const dogName = (did: number) => names.dogs.find((d) => d.id === did)?.name ?? "Hund";
  const several = form.dogIds.length > 1;
  const count = (eid: number, did: number, field: "ok" | "fail") => reps.find((r) => r.exerciseId === eid && r.dogId === did)?.[field] ?? 0;
  const addable = names.exercises.filter((x) => !exerciseIds.includes(x.id));
  const add = (eid: number) => change({ reps: [...form.reps, ...form.dogIds.map((dogId) => ({ exerciseId: eid, dogId, ok: 0, fail: 0 }))] });
  const kinds = [...names.treatKinds.map((k) => ({ id: k.id, name: k.name })), ...form.treats.filter((t) => !names.treatKinds.some((k) => k.id === t.treatKindId)).map((t) => ({ id: t.treatKindId, name: "Leckerli" }))];
  const treatCount = (kid: number) => form.treats.find((t) => t.treatKindId === kid)?.count ?? 0;
  const summary = trainingSummaryLine(
    reps.map((r) => ({ name: exerciseName(r.exerciseId), ok: r.ok, fail: r.fail })),
    form.treats.reduce((n, t) => n + t.count, 0),
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text testID="edit-training-summary" style={[styles.summary, { color: theme.ink }]}>
        {summary}
      </Text>
      {exerciseIds.flatMap((eid) =>
        form.dogIds.map((did) => {
          const label = several ? `${exerciseName(eid)} ${dogName(did)}` : exerciseName(eid);
          return (
            <View key={`${eid}/${did}`} style={styles.repRow}>
              <Text style={[styles.repName, { color: theme.ink }]} numberOfLines={2}>
                {label}
              </Text>
              <Counter sign="✓" value={count(eid, did, "ok")} what={`${label} klappt`} onStep={(d) => change({ reps: bumpRep(form.reps, eid, did, "ok", d) })} />
              <Counter sign="✗" value={count(eid, did, "fail")} what={`${label} klappt nicht`} onStep={(d) => change({ reps: bumpRep(form.reps, eid, did, "fail", d) })} />
            </View>
          );
        }),
      )}
      {addable.length ? (
        <View style={styles.chips}>
          {addable.map((x) => (
            <Chip key={x.id} label={`+ ${x.name}`} a11y={`Übung ${x.name} dazu`} on={false} onPress={() => add(x.id)} />
          ))}
        </View>
      ) : null}
      {kinds.map((k) => (
        <View key={k.id} style={styles.repRow}>
          <Text style={[styles.repName, { color: theme.ink }]}>{k.name}</Text>
          <Counter sign="" value={treatCount(k.id)} what={k.name} onStep={(d) => change({ treats: bumpTreat(form.treats, k.id, d) })} />
        </View>
      ))}
    </View>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.small, { color: theme.muted }]}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Amount({ value, step, onStep, min, max }: { value: string; step: string; onStep: (d: 1 | -1) => void; min: boolean; max: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.amountRow}>
      <Step label={`${step} weniger`} sign="−" big disabled={min} onPress={() => onStep(-1)} />
      <Text testID="edit-amount" style={[styles.amount, { color: theme.ink }]}>
        {value}
      </Text>
      <Step label={`${step} mehr`} sign="+" big disabled={max} onPress={() => onStep(1)} />
    </View>
  );
}

function Counter({ sign, value, what, onStep }: { sign: string; value: number; what: string; onStep: (d: 1 | -1) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.counter}>
      <Step label={`${what}: eins weniger`} sign="−" disabled={value === 0} onPress={() => onStep(-1)} />
      <Text style={[styles.count, { color: theme.ink }]}>{`${sign}${sign ? " " : ""}${value}`}</Text>
      <Step label={`${what}: eins mehr`} sign="+" disabled={false} onPress={() => onStep(1)} />
    </View>
  );
}

function Step({ label, sign, disabled, big, onPress }: { label: string; sign: string; disabled: boolean; big?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [big ? styles.stepBig : styles.step, { backgroundColor: big ? theme.surface : theme.neutral, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[big ? styles.stepTextBig : styles.stepText, { color: theme.ink }]}>{sign}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  message: { fontSize: 15, fontWeight: "600" },
  times: { flexDirection: "row", gap: 8 },
  switch: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  segmentText: { fontSize: 14, fontWeight: "700" },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amount: { fontSize: 30, fontWeight: "700" },
  group: { gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { borderRadius: radius.tile, padding: 12, gap: 8 },
  summary: { fontSize: 15, fontWeight: "700" },
  repRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repName: { flex: 1, fontSize: 15 },
  counter: { flexDirection: "row", alignItems: "center", gap: 4 },
  count: { minWidth: 34, textAlign: "center", fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  step: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 20, fontWeight: "700" },
  stepBig: { width: 56, height: 56, borderRadius: radius.tile, alignItems: "center", justifyContent: "center" },
  stepTextBig: { fontSize: 26, fontWeight: "700" },
  note: { borderRadius: 12, padding: 12, minHeight: 60, fontSize: 15 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  pair: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
});
