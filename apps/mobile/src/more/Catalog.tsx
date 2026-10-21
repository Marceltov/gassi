// Übungen und Leckerli: the household's lists for training. A tap opens one to rename it (a treat also its grams per
// piece and whether it comes out of the dry food) or remove it; removed ones keep their name in past trainings.
import type { Client } from "@gassi/api-client";
import { parseDecimal } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import type { Exercise, TreatKind } from "../data/store";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useBack } from "./back";
import { Group, Row } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Editing = { what: "exercise"; item: Exercise | null; name: string } | { what: "treat"; item: TreatKind | null; name: string; grams: string; fromDry: boolean };

const grams = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function Catalog() {
  const theme = useTheme();
  const back = useBack();
  const { refresh } = useGassi();
  const { data, error, reload } = useServer((a) => Promise.all([a.exercises(), a.treatKinds()]));
  const { message, setMessage, run } = useWrite();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [exercises, treats] = data ? [data[0].exercises, data[1].treatKinds] : [[], []];

  const open = (e: Editing) => {
    setMessage(null);
    setEditing(e);
  };
  const change = async (call: (api: Client) => Promise<unknown>) => {
    if (await run(call)) {
      setEditing(null);
      reload();
      void refresh(); // Training offers the lists anew
    }
  };
  const save = (e: Editing) =>
    void change(async (api) => {
      if (e.what === "exercise") await (e.item ? api.updateExercise({ id: e.item.id, name: e.name }) : api.addExercise({ name: e.name }));
      else {
        const t = { name: e.name, gramsPerPiece: parseDecimal(e.grams), fromDry: e.fromDry };
        await (e.item ? api.updateTreatKind({ id: e.item.id, ...t }) : api.addTreatKind(t));
      }
    });
  const remove = (e: Editing) =>
    void change(async (api) => {
      if (!e.item) return;
      await (e.what === "exercise" ? api.updateExercise({ id: e.item.id, archived: true }) : api.updateTreatKind({ id: e.item.id, archived: true }));
    });

  const newTreat: Editing = { what: "treat", item: null, name: "", grams: "", fromDry: false };
  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Übungen und Leckerli</Text>
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          {data ? (
            <>
              <Group title="Übungen">
                {exercises.length ? null : <Row label="Noch keine" muted />}
                {exercises.map((x) => (
                  <Row key={x.id} label={x.name} onPress={() => open({ what: "exercise", item: x, name: x.name })} />
                ))}
              </Group>
              <Group title="Leckerli">
                {treats.length ? null : <Row label="Noch keine" muted />}
                {treats.map((t) => (
                  <Row
                    key={t.id}
                    label={t.name}
                    value={`${grams(t.gramsPerPiece)} g${t.fromDry ? " · aus dem Trockenfutter" : ""}`}
                    onPress={() => open({ what: "treat", item: t, name: t.name, grams: grams(t.gramsPerPiece), fromDry: t.fromDry })}
                  />
                ))}
              </Group>
            </>
          ) : null}
          <Sheet open={!!editing} onClose={() => setEditing(null)}>
            {editing ? (
              <View testID="catalog-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{editing.item?.name ?? (editing.what === "exercise" ? "Neue Übung" : "Neues Leckerli")}</Text>
                <Field label="Name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} autoFocus={!editing.item} />
                {editing.what === "treat" ? (
                  <>
                    <Field label="Gramm pro Stück" value={editing.grams} onChangeText={(g) => setEditing({ ...editing, grams: g })} inputMode="decimal" keyboardType="decimal-pad" />
                    <View style={styles.chips}>
                      <Chip label="Aus dem Trockenfutter" on={editing.fromDry} onPress={() => setEditing({ ...editing, fromDry: !editing.fromDry })} />
                    </View>
                  </>
                ) : null}
                {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
                <BigButton kind="training" size="l" label={editing.item ? "Speichern" : "Hinzufügen"} disabled={!editing.name.trim()} onPress={() => save(editing)} />
                {editing.item ? <BigButton kind="neutral" size="m" label="Entfernen" onPress={() => remove(editing)} /> : null}
                <BigButton kind="neutral" size="m" label="Abbrechen" onPress={() => setEditing(null)} />
              </View>
            ) : null}
          </Sheet>
        </>
      }
      bottom={
        <>
          <View style={styles.pair}>
            <View style={styles.half}>
              <BigButton kind="training" size="l" label="Übung dazu" onPress={() => open({ what: "exercise", item: null, name: "" })} />
            </View>
            <View style={styles.half}>
              <BigButton kind="training" size="l" label="Leckerli dazu" onPress={() => open(newTreat)} />
            </View>
          </View>
          <BigButton kind="neutral" size="m" label="Zurück" onPress={back} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  message: { fontSize: 15, fontWeight: "600" },
  pair: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
});
