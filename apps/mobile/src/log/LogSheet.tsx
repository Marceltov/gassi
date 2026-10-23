// Logging a note or an encounter, from Start or on a walk (#91, #37, #90): "Begegnung" asks Mensch or Hund, then which
// dog (as Pipi and Poopoo do, only when several could be meant), then a sheet with the encounter's details and a note; a
// note is only its text. Eintragen sends it as a tap (log.entry), so it works without reception and lands on a walk by
// its time (ADR 0002); it stays grey until what the entry needs is there.
import { checkDetails, type EntryDetails, newId, TYPE_LABEL } from "@gassi/domain";

type Place = NonNullable<EntryDetails["place"]>;
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useServer } from "../more/useServer";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { ChoiceSheet, dogChoices } from "../ui/ChoiceSheet";
import { Sheet } from "../ui/Sheet";
import { DetailFields } from "./DetailFields";

export type LogKind = "note" | "dogEncounter" | "personEncounter";

/** "Begegnung": Mensch or Hund. */
export function EncounterChoice({ open, onPick, onClose }: { open: boolean; onPick: (kind: LogKind) => void; onClose: () => void }) {
  const theme = useTheme();
  const choices = [
    { key: "person", label: "Mensch", icon: "people" as const, onPress: () => onPick("personEncounter") },
    { key: "dog", label: "Hund", icon: "dog" as const, onPress: () => onPick("dogEncounter") },
  ];
  return <ChoiceSheet testID="encounter-choice" open={open} title="Begegnung mit …" choices={choices} accent={theme.encounter} onClose={onClose} />;
}

/** What a button starts: a Begegnung (Mensch or Hund first) or a Notiz. */
export type LogStart = "encounter" | "note";

/** The steps from `start` to the entry: Mensch or Hund, which dog of `dogIds` (the walk's, else the active ones), the
 * form. `place`: where a person is met by default. Closing any step ends it (`onDone`). */
export function Logging({ start, dogIds, place, onDone }: { start: LogStart | null; dogIds: readonly number[]; place: Place; onDone: () => void }) {
  const { dogs } = useGassi();
  const [shown, setShown] = useState<LogStart | null>(null);
  const [kind, setKind] = useState<LogKind | null>(null);
  const [dogId, setDogId] = useState<number | null>(null);
  if (start !== shown) {
    setShown(start);
    setKind(start === "note" ? "note" : null);
    setDogId(dogIds.length === 1 ? dogIds[0] : null);
  }
  const needsDog = kind !== null && kind !== "note";
  return (
    <>
      <EncounterChoice open={start === "encounter" && kind === null} onPick={setKind} onClose={onDone} />
      <ChoiceSheet testID="dog-choice" open={needsDog && dogId === null} title={kind ? `${TYPE_LABEL[kind]} – welcher Hund?` : ""} choices={dogChoices(dogIds, dogs, setDogId)} onClose={onDone} />
      <Sheet open={kind !== null && (!needsDog || dogId !== null)} onClose={onDone} label={kind ? TYPE_LABEL[kind] : undefined}>
        {kind && (!needsDog || dogId !== null) ? <LogForm key={kind} kind={kind} dogId={dogId} place={place} onClose={onDone} /> : null}
      </Sheet>
    </>
  );
}

function LogForm({ kind, dogId, place, onClose }: { kind: LogKind; dogId: number | null; place: Place; onClose: () => void }) {
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
  note: { minHeight: 64, borderRadius: 12, borderWidth: 1, padding: 10, fontSize: 16, textAlignVertical: "top" },
  tall: { minHeight: 140 },
});
