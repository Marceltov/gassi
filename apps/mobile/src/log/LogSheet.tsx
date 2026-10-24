// Logging something from Start or on a walk, one flow for all: a note (#91), an encounter (#37, #90), a command or a
// treat without a training (#36). "Begegnung" asks Mensch or Hund, then everything for a dog asks which dog (as Pipi and
// Poopoo do, only when several could be meant), then its sheet: an encounter's details and a note; a note's text; a
// command's exercise and treat with ✓ klappt / ✗ klappt nicht; a treat's kind (with one kind there is nothing to ask).
// Everything is sent as a tap, so it works without reception and lands on a walk by its time (ADR 0002); the last
// exercise and treat kind are preset next time. On a walk a tap on Kommando or Leckerli logs the usual at once and only a
// hold opens the sheet (#98, quick.ts).
import { checkDetails, type Command, type EntryDetails, newId, TYPE_LABEL } from "@gassi/domain";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useServer } from "../more/useServer";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { ChoiceSheet, dogChoices } from "../ui/ChoiceSheet";
import { Sheet } from "../ui/Sheet";
import { loadKept, saveKept } from "../data/kept";
import { Chip } from "../ui/Chip";
import { ChoiceList } from "../ui/ChoiceList";
import { DetailFields } from "./DetailFields";
import { quickLines, quickOf, usualOf } from "./quick";

type Place = NonNullable<EntryDetails["place"]>;
export type LogKind = "note" | "dogEncounter" | "personEncounter" | "command" | "treat";

// what is usual on this phone: the last command's exercise and whether it had a treat, the Leckerli on you
const LAST = "quick";
type Last = { exerciseId?: number; treatKindId?: number | null; commandTreat?: boolean };
const lastOf = (): Last => (loadKept(LAST) as Last | null) ?? {};
const remember = (l: Last) => saveKept(LAST, { ...lastOf(), ...l });

/** What a tap on the walk's Kommando and Leckerli gives: "Sitz · Käse", "Käse". */
export function useQuickLines() {
  const { exercises, treatKinds } = useGassi();
  return quickLines(lastOf(), exercises, treatKinds);
}

/** "Begegnung": Mensch or Hund. */
export function EncounterChoice({ open, onPick, onClose }: { open: boolean; onPick: (kind: LogKind) => void; onClose: () => void }) {
  const theme = useTheme();
  const choices = [
    { key: "person", label: "Mensch", icon: "people" as const, onPress: () => onPick("personEncounter") },
    { key: "dog", label: "Hund", icon: "dog" as const, onPress: () => onPick("dogEncounter") },
  ];
  return <ChoiceSheet testID="encounter-choice" open={open} title="Begegnung mit …" choices={choices} accent={theme.encounter} onClose={onClose} />;
}

/** What a button starts: a Begegnung (Mensch or Hund first), a Notiz, a Kommando or a Leckerli. */
export type LogStart = "encounter" | "note" | "command" | "treat";

/** The steps from `start` to the entry: Mensch or Hund, which dog of `dogIds` (the walk's, else the active ones), the
 * form. `place`: where a person is met by default. `quick`: a command or treat logs the usual without the form. Closing
 * any step ends it (`onDone`). */
export function Logging({ start, quick = false, dogIds, place, onDone }: { start: LogStart | null; quick?: boolean; dogIds: readonly number[]; place: Place; onDone: () => void }) {
  const { dogs, exercises, treatKinds, send } = useGassi();
  const [shown, setShown] = useState<LogStart | null>(null);
  const [kind, setKind] = useState<LogKind | null>(null);
  const [dogId, setDogId] = useState<number | null>(null);
  if (start !== shown) {
    setShown(start);
    setKind(start === "encounter" ? null : start);
    setDogId(dogIds.length === 1 ? dogIds[0] : null);
  }
  const needsDog = kind !== null && kind !== "note";
  const ready = kind !== null && (!needsDog || dogId !== null);
  // nothing to ask: logged at once
  const now = ready && dogId !== null && (kind === "command" || kind === "treat") ? quickOf(kind, lastOf(), exercises, treatKinds, quick) : null;
  const [nowKind, exerciseId, treatKindId] = [now?.kind, now?.kind === "quick.command" ? now.exerciseId : undefined, now?.treatKindId];
  useEffect(() => {
    if (dogId === null || nowKind === undefined) return;
    const at = new Date().toISOString();
    if (nowKind === "quick.treat" && treatKindId !== undefined) send({ id: newId(), at, kind: nowKind, dogId, treatKindId });
    if (nowKind === "quick.command" && exerciseId !== undefined) send({ id: newId(), at, kind: nowKind, dogId, exerciseId, ok: true, treatKindId });
    onDone();
  }, [nowKind, exerciseId, treatKindId, dogId, send, onDone]);
  const tap = (c: Command) => {
    send(c);
    onDone();
  };
  return (
    <>
      <EncounterChoice open={start === "encounter" && kind === null} onPick={setKind} onClose={onDone} />
      <ChoiceSheet testID="dog-choice" open={needsDog && dogId === null} title={kind ? `${TYPE_LABEL[kind]} – welcher Hund?` : ""} choices={dogChoices(dogIds, dogs, setDogId)} onClose={onDone} />
      <Sheet open={ready && now === null} onClose={onDone} label={kind ? TYPE_LABEL[kind] : undefined}>
        {ready && kind === "command" && dogId !== null && now === null ? <CommandForm dogId={dogId} onTap={tap} /> : null}
        {ready && kind === "treat" && dogId !== null && now === null ? <TreatForm dogId={dogId} onTap={tap} /> : null}
        {ready && kind !== null && kind !== "command" && kind !== "treat" ? <LogForm key={kind} kind={kind} dogId={dogId} place={place} onClose={onDone} /> : null}
      </Sheet>
    </>
  );
}

/** A command: which exercise, a treat with it (or none), then ✓ klappt or ✗ klappt nicht logs it. */
function CommandForm({ dogId, onTap }: { dogId: number; onTap: (c: Command) => void }) {
  const theme = useTheme();
  const { exercises, treatKinds } = useGassi();
  const kinds = treatKinds;
  const usual = usualOf(lastOf(), exercises, kinds);
  const [exerciseId, setExerciseId] = useState<number | null>(usual.exercise?.id ?? exercises[0]?.id ?? null);
  const [treatKindId, setTreatKindId] = useState<number | null>(usual.commandTreat ? (usual.treatKind?.id ?? kinds[0]?.id ?? null) : null);
  const log = (ok: boolean) => {
    if (exerciseId === null) return;
    remember({ exerciseId, commandTreat: treatKindId !== null, ...(treatKindId !== null ? { treatKindId } : {}) });
    onTap({ id: newId(), at: new Date().toISOString(), kind: "quick.command", dogId, exerciseId, ok, treatKindId: ok && treatKindId !== null ? treatKindId : undefined });
  };
  return (
    <View testID="command-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{TYPE_LABEL.command}</Text>
      {exercises.length ? (
        <View style={styles.chips}>
          {exercises.map((e) => (
            <Chip key={e.id} label={e.name} accent={theme.training} on={e.id === exerciseId} onPress={() => setExerciseId(e.id)} />
          ))}
        </View>
      ) : (
        <Text style={[styles.small, { color: theme.muted }]}>Noch keine Übungen – in Mehr → Übungen anlegen.</Text>
      )}
      {kinds.length ? (
        <View style={styles.chips}>
          {kinds.map((k) => (
            <Chip key={k.id} label={`+ 1 ${k.name}`} accent={theme.treat} on={k.id === treatKindId} onPress={() => setTreatKindId(k.id === treatKindId ? null : k.id)} />
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.cell}>
          <BigButton kind="neutral" size="l" icon="cross" label="klappt nicht" disabled={exerciseId === null} onPress={() => log(false)} />
        </View>
        <View style={styles.cell}>
          <BigButton kind="walk" size="l" icon="check" label="klappt" disabled={exerciseId === null} onPress={() => log(true)} />
        </View>
      </View>
    </View>
  );
}

/** A treat on its own: a tap on its kind logs one. */
function TreatForm({ dogId, onTap }: { dogId: number; onTap: (c: Command) => void }) {
  const theme = useTheme();
  const { treatKinds } = useGassi();
  const kinds = treatKinds;
  const last = usualOf(lastOf(), [], kinds).treatKind?.id;
  const give = (treatKindId: number) => {
    remember({ treatKindId });
    onTap({ id: newId(), at: new Date().toISOString(), kind: "quick.treat", dogId, treatKindId });
  };
  return (
    <View testID="treat-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{TYPE_LABEL.treat}</Text>
      {kinds.length ? (
        <ChoiceList accent={theme.treat} choices={kinds.map((k) => ({ key: k.id, label: k.name, on: k.id === last, onPress: () => give(k.id) }))} />
      ) : (
        <Text style={[styles.small, { color: theme.muted }]}>Noch keine Leckerli – in Mehr → Leckerli anlegen.</Text>
      )}
    </View>
  );
}

function LogForm({ kind, dogId, place, onClose }: { kind: Exclude<LogKind, "command" | "treat">; dogId: number | null; place: Place; onClose: () => void }) {
  const theme = useTheme();
  const { send } = useGassi();
  const { height } = useWindowDimensions();
  const [details, setDetails] = useState<EntryDetails>(kind === "personEncounter" ? { place } : {});
  const [note, setNote] = useState("");
  // who earlier encounters were with, newest first, each once
  const { data } = useServer((api) => (kind === "personEncounter" ? api.entries({ type: "personEncounter" }) : Promise.resolve(null)));
  const names = [...new Set((data?.entries ?? []).flatMap((e) => (e.details?.who ? [e.details.who] : [])))];

  const forDog = kind !== "note";
  const missing = kind === "note" ? !note.trim() : !!checkDetails(kind, details);
  const save = () => {
    send({ id: newId(), at: new Date().toISOString(), kind: "log.entry", type: kind, dogId: forDog && dogId !== null ? dogId : undefined, note: note.trim() || undefined, details: forDog ? details : undefined });
    onClose();
  };

  return (
    <View testID="log-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{TYPE_LABEL[kind]}</Text>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
        <DetailFields type={kind} details={details} change={setDetails} suggestions={{ who: names }} />
        <TextInput
          accessibilityLabel={kind === "note" ? "Notiz" : "Notiz zur Begegnung"}
          value={note}
          onChangeText={setNote}
          placeholder={kind === "note" ? "Was ist dir aufgefallen?" : "Auffälligkeiten, Notizen (optional)"}
          placeholderTextColor={theme.muted}
          multiline
          maxLength={1000}
          style={[styles.note, kind === "note" && styles.tall, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
        />
      </ScrollView>
      <ButtonRow
        side={[<BigButton key="no" kind="side" size="m" label="Abbrechen" onPress={onClose} />]}
        main={<BigButton kind={kind === "note" ? "ink" : "encounter"} size="m" icon="check" label="Eintragen" disabled={missing} onPress={save} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  fields: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
  small: { fontSize: 13 },
  note: { minHeight: 64, borderRadius: 12, borderWidth: 1, padding: 10, fontSize: 16, textAlignVertical: "top" },
  tall: { minHeight: 140 },
});
