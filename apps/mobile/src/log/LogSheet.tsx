// Logging a note or an encounter, from Start or on a walk (#91, #37, #90): "Begegnung" asks Mensch or Hund first, then
// a sheet with the encounter's details, the dog (only when several could be meant) and a note; a note is only its text.
// Eintragen sends it as a tap (log.entry), so it works without reception and lands on a walk by its time (ADR 0002);
// it waits until what the entry needs is there, and says what is missing.
import { checkDetails, type EntryDetails, newId, type Place, TYPE_LABEL } from "@gassi/domain";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useServer } from "../more/useServer";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Chip } from "../ui/Chip";
import { ChoiceSheet } from "../ui/ChoiceSheet";
import { Sheet } from "../ui/Sheet";
import { DogEncounterFields, PersonEncounterFields } from "./EncounterFields";

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

/** `dogIds`: the dogs it can be about (the walk's, else the active ones); `place`: where a person is met by default. */
export function LogSheet({ kind, dogIds, place, onClose }: { kind: LogKind | null; dogIds: readonly number[]; place: Place; onClose: () => void }) {
  return (
    <Sheet open={kind !== null} onClose={onClose} label={kind ? TYPE_LABEL[kind] : undefined}>
      {kind ? <LogForm key={kind} kind={kind} dogIds={dogIds} place={place} onClose={onClose} /> : null}
    </Sheet>
  );
}

function LogForm({ kind, dogIds, place, onClose }: { kind: LogKind; dogIds: readonly number[]; place: Place; onClose: () => void }) {
  const theme = useTheme();
  const { send, dogs } = useGassi();
  const { height } = useWindowDimensions();
  const [dogId, setDogId] = useState<number | null>(dogIds.length === 1 ? dogIds[0] : null);
  const [details, setDetails] = useState<EntryDetails>(kind === "personEncounter" ? { place } : {});
  const [note, setNote] = useState("");
  // who earlier encounters were with, newest first, each once
  const { data } = useServer((api) => (kind === "personEncounter" ? api.entries({ type: "personEncounter" }) : Promise.resolve(null)));
  const names = [...new Set((data?.entries ?? []).flatMap((e) => (e.details?.who ? [e.details.who] : [])))];

  const forDog = kind !== "note";
  const missing = forDog && dogId === null ? "Welcher Hund?" : kind === "note" ? (note.trim() ? null : "Was ist dir aufgefallen?") : checkDetails(kind, details);
  const save = () => {
    send({ id: newId(), at: new Date().toISOString(), kind: "log.entry", type: kind, dogId: forDog && dogId !== null ? dogId : undefined, note: note.trim() || undefined, details: forDog ? details : undefined });
    onClose();
  };

  return (
    <View testID="log-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>{TYPE_LABEL[kind]}</Text>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
        {forDog && dogIds.length > 1 ? (
          <View style={styles.chips}>
            {dogIds.map((id) => {
              const dog = dogs.find((d) => d.id === id);
              return <Chip key={id} label={dog?.name ?? "Hund"} color={dog?.color} on={dogId === id} onPress={() => setDogId(id)} />;
            })}
          </View>
        ) : null}
        {kind === "dogEncounter" ? <DogEncounterFields details={details} change={setDetails} /> : null}
        {kind === "personEncounter" ? <PersonEncounterFields details={details} change={setDetails} names={names} /> : null}
        <TextInput
          accessibilityLabel={kind === "note" ? "Notiz" : "Notiz zur Begegnung"}
          value={note}
          onChangeText={setNote}
          placeholder={kind === "note" ? "Was ist dir aufgefallen? (diktieren geht)" : "Auffälligkeiten, Notizen (optional)"}
          placeholderTextColor={theme.muted}
          multiline
          maxLength={1000}
          style={[styles.note, kind === "note" && styles.tall, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
        />
      </ScrollView>
      {missing ? <Text style={[styles.small, { color: theme.muted }]}>{missing}</Text> : null}
      <ButtonRow
        side={[<BigButton key="no" kind="side" size="m" label="Abbrechen" onPress={onClose} />]}
        main={<BigButton kind={kind === "note" ? "ink" : "encounter"} size="m" icon="check" label="Eintragen" disabled={!!missing} onPress={save} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  fields: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  note: { minHeight: 64, borderRadius: 12, borderWidth: 1, padding: 10, fontSize: 16, textAlignVertical: "top" },
  tall: { minHeight: 140 },
  small: { fontSize: 13 },
});
