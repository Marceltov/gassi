// One entry from Verlauf, to be put right afterwards: its time (and end), the dogs, for a walk who went, for food the
// amount and kind, for weight the weight, for a training its repetitions per exercise and dog and its treats, a note;
// Speichern sends it all, Löschen asks first. What it is and who entered it stay on top, the buttons at the bottom
// (#71). A wet count (one row per can size) is one thing here: its sizes in one line,
// its time moved and its rows deleted together. Both need the server (the writes' client): they say so without
// reception (OFFLINE), and without an answer in time that it may have been saved (NO_ANSWER).
import { clampPortion, countLine, countTitle, describeEntry, dogRule, FOOD_MAX_G, formatKg, keepsOne, trainingSummaryLine, TYPE_LABEL } from "@gassi/domain";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { errorMessage } from "../data/api";
import { type Gassi, useGassi } from "../data/GassiProvider";
import { type ButtonKind, radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { FOOD_KIND_OPTIONS } from "../ui/foodKinds";
import { Icon, type IconName } from "../ui/Icon";
import { TYPE_ICON } from "../ui/icons";
import { Screen } from "../ui/Screen";
import { Segments } from "../ui/Segments";
import { Sheet } from "../ui/Sheet";
import { AmountStepper, StepButton } from "../ui/Stepper";
import { LAST_WALKER } from "../walk/lastOne";
import { bumpRep, bumpTreat, editInput, type Entry, type Form, formOf, pickDog, trainingInput } from "./form";
import { TIME_ZONE } from "../time";
import { TimeField } from "./TimeField";

const BUTTON: Partial<Record<Entry["type"], ButtonKind>> = { walk: "walk", food: "food", training: "training", pee: "pee", poop: "poop" };

export function EntryDetail({ id }: { id: number }) {
  const router = useRouter();
  const theme = useTheme();
  const { api, writeApi, people, dogs, exercises, treatKinds } = useGassi();
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
  const run = async (call: () => Promise<void>, then: () => void = back) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await call();
      then();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      busy.current = false;
    }
  };
  const save = (e: Entry, f: Form) =>
    run(async () => {
      if (!writeApi) return;
      await writeApi.editEntry(editInput(e, f));
      if (e.type === "training") await writeApi.editTraining(trainingInput(e, f));
    });
  // a deleted walk has no summary to go back to: the first screen of the tab it was opened on (Verlauf, or Start right
  // after the walk); anything else goes back to where it was opened
  const remove = (e: Entry) =>
    run(
      async () => {
        setAsking(false);
        if (writeApi) await writeApi.deleteEntry({ id });
      },
      e.type === "walk" ? () => router.dismissAll() : back,
    );

  if (!entry || !form) {
    const waitText = <Text style={[styles.small, { color: theme.muted }]}>{message ?? "Lädt …"}</Text>;
    return <Screen top={waitText} />;
  }

  const change = (c: Partial<Form>) => setForm({ ...form, ...c });
  const rule = dogRule(entry.type);
  const shownDogs = dogs.filter((d) => !d.archived || entry.dogIds.includes(d.id));
  const everyone = [...people, ...entry.walkerIds.flatMap((w, i) => (people.some((p) => p.id === w) ? [] : [{ id: w, name: entry.walkers[i] ?? w }]))];
  const toggleWalker = (pid: string) => {
    if (!form.walkerIds.includes(pid)) change({ walkerIds: [...form.walkerIds, pid] });
    else if (keepsOne(form.walkerIds, pid)) change({ walkerIds: form.walkerIds.filter((w) => w !== pid) });
    else setMessage(LAST_WALKER);
  };
  const running = !!entry.clientKey && !entry.endedAt;
  const timed = entry.type === "walk" || entry.type === "training";

  return (
    <Screen
      head={
        <>
          <View style={styles.heading}>
            <Icon name={TYPE_ICON[entry.type]} size={24} color={theme.muted} />
            <Text style={[styles.title, { color: theme.ink }]}>{entry.count ? countTitle(entry.at, TIME_ZONE) : TYPE_LABEL[entry.type]}</Text>
          </View>
          {entry.count || entry.type === "opened" ? (
            // what was counted, or which can was opened ("400-g-Dose"), to check before deleting it
            <Text testID="count-line" style={[styles.countLine, { color: theme.ink }]}>
              {entry.count ? countLine(entry.count) : describeEntry(entry).extra}
            </Text>
          ) : null}
          <Text style={[styles.small, { color: theme.muted }]}>{`eingetragen von ${entry.byName}`}</Text>
        </>
      }
      top={
        <>
          <View style={styles.times}>
            <TimeField label={timed ? "Beginn" : "Zeit"} value={form.at} onChange={(at) => change({ at })} />
            {form.endedAt !== null ? <TimeField label="Ende" value={form.endedAt} onChange={(endedAt) => change({ endedAt })} /> : null}
          </View>
          {running ? <Text style={[styles.small, { color: theme.muted }]}>Läuft noch.</Text> : null}

          {entry.type === "food" ? (
            <>
              <Segments options={FOOD_KIND_OPTIONS} value={form.foodKind ?? "wet"} onChange={(foodKind) => change({ foodKind })} kind="food" />
              <AmountStepper testID="edit-amount" value={`${form.amountG ?? 0} g`} step="10 g" onStep={(d) => change({ amountG: clampPortion((form.amountG ?? 0) + d * 10) })} atMin={(form.amountG ?? 0) <= 1} atMax={(form.amountG ?? 0) >= FOOD_MAX_G} />
            </>
          ) : null}
          {entry.type === "weight" ? <AmountStepper testID="edit-amount" value={formatKg(form.amountG ?? 0)} step="100 g" onStep={(d) => change({ amountG: Math.max(100, (form.amountG ?? 0) + d * 100) })} atMin={(form.amountG ?? 0) <= 100} atMax={false} /> : null}

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
          <Sheet open={asking} onClose={() => setAsking(false)} label="Eintrag löschen?">
            <View testID="delete-sheet" style={styles.sheet}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>Eintrag löschen?</Text>
              <Text style={[styles.small, { color: theme.muted }]}>{`${entry.count ? `Die ganze Zählung (${countLine(entry.count)})` : TYPE_LABEL[entry.type]} – das lässt sich nicht rückgängig machen.`}</Text>
              <BigButton kind="neutral" size="s" label="Abbrechen" onPress={() => setAsking(false)} />
              <BigButton kind="neutral" size="m" label="Ja, löschen" onPress={() => void remove(entry)} />
            </View>
          </Sheet>
        </>
      }
      bottom={
        <>
          {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
          <BigButton kind="neutral" size="s" label="Löschen" onPress={() => setAsking(true)} />
          <BigButton kind={BUTTON[entry.type] ?? "neutral"} size="m" icon="check" label="Speichern" onPress={() => void save(entry, form)} />
        </>
      }
    />
  );
}

type Names = Pick<Gassi, "dogs" | "exercises" | "treatKinds">;

// A training's repetitions per exercise (and dog, when several train) as counts of "klappt" and "klappt nicht", more exercises from the
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
              <Counter sign="check" value={count(eid, did, "ok")} what={`${label} klappt`} onStep={(d) => change({ reps: bumpRep(form.reps, eid, did, "ok", d) })} />
              <Counter sign="cross" value={count(eid, did, "fail")} what={`${label} klappt nicht`} onStep={(d) => change({ reps: bumpRep(form.reps, eid, did, "fail", d) })} />
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
          <Counter value={treatCount(k.id)} what={k.name} onStep={(d) => change({ treats: bumpTreat(form.treats, k.id, d) })} />
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

function Counter({ sign, value, what, onStep }: { sign?: IconName; value: number; what: string; onStep: (d: 1 | -1) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.counter}>
      <StepButton small label={`${what}: eins weniger`} sign="−" disabled={value === 0} onPress={() => onStep(-1)} />
      <View style={styles.countBox}>
        {sign ? <Icon name={sign} size={15} color={theme.muted} /> : null}
        <Text style={[styles.count, { color: theme.ink }]}>{value}</Text>
      </View>
      <StepButton small label={`${what}: eins mehr`} sign="+" disabled={false} onPress={() => onStep(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  countLine: { fontSize: 18, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700" },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  small: { fontSize: 13 },
  message: { fontSize: 15, fontWeight: "600" },
  times: { flexDirection: "row", gap: 8 },
  group: { gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { borderRadius: radius.tile, padding: 12, gap: 8 },
  summary: { fontSize: 15, fontWeight: "700" },
  repRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repName: { flex: 1, fontSize: 15 },
  counter: { flexDirection: "row", alignItems: "center", gap: 4 },
  countBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 44 },
  count: { minWidth: 18, textAlign: "center", fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  note: { borderRadius: 12, padding: 12, minHeight: 60, fontSize: 16 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
});
