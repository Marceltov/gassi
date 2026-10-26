// Übungen or Leckerli: one of the household's lists for training, each its own screen in Mehr. A tap opens one to rename
// it (a treat also its grams per piece, whether it comes out of the dry food and whether the training offers it, #126)
// or remove it; removed ones keep their name in past trainings.
import type { Client } from "@gassi/api-client";
import { parseDecimal } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import type { Exercise, TreatKind } from "../data/store";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow, TrashButton } from "../ui/ButtonRow";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { Group, Row } from "../ui/List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Editing = { what: "exercise"; item: Exercise | null; name: string } | { what: "treat"; item: TreatKind | null; name: string; grams: string; fromDry: boolean; training: boolean };

const grams = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function Catalog({ what }: { what: Editing["what"] }) {
  const theme = useTheme();
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
        const t = { name: e.name, gramsPerPiece: parseDecimal(e.grams), fromDry: e.fromDry, training: e.training };
        await (e.item ? api.updateTreatKind({ id: e.item.id, ...t }) : api.addTreatKind(t));
      }
    });
  const remove = (e: Editing) =>
    void change(async (api) => {
      if (!e.item) return;
      await (e.what === "exercise" ? api.updateExercise({ id: e.item.id, archived: true }) : api.updateTreatKind({ id: e.item.id, archived: true }));
    });

  const newTreat: Editing = { what: "treat", item: null, name: "", grams: "", fromDry: false, training: true };
  return (
    <Screen
      head={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>{what === "exercise" ? "Übungen" : "Leckerli"}</Text>
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
        </>
      }
      top={
        <>
          {data && what === "exercise" ? (
            <Group>
              {exercises.length ? null : <Row label="Noch keine" muted />}
              {exercises.map((x) => (
                <Row key={x.id} label={x.name} onPress={() => open({ what: "exercise", item: x, name: x.name })} />
              ))}
            </Group>
          ) : null}
          {data && what === "treat" ? (
            <Group>
              {treats.length ? null : <Row label="Noch keine" muted />}
              {treats.map((t) => (
                <Row
                  key={t.id}
                  label={t.name}
                  value={`${grams(t.gramsPerPiece)} g${t.fromDry ? " · aus dem Trockenfutter" : ""}${t.training ? " · fürs Training" : ""}`}
                  onPress={() => open({ what: "treat", item: t, name: t.name, grams: grams(t.gramsPerPiece), fromDry: t.fromDry, training: t.training })}
                />
              ))}
            </Group>
          ) : null}
          <Sheet open={!!editing} onClose={() => setEditing(null)} label={editing ? (editing.item?.name ?? (editing.what === "exercise" ? "Neue Übung" : "Neues Leckerli")) : undefined}>
            {editing ? (
              <View testID="catalog-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{editing.item?.name ?? (editing.what === "exercise" ? "Neue Übung" : "Neues Leckerli")}</Text>
                <Field label="Name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} autoFocus={!editing.item} />
                {editing.what === "treat" ? (
                  <>
                    <Field label="Gramm pro Stück" value={editing.grams} onChangeText={(g) => setEditing({ ...editing, grams: g })} inputMode="decimal" keyboardType="decimal-pad" />
                    <View style={styles.chips}>
                      <Chip label="Aus dem Trockenfutter" on={editing.fromDry} onPress={() => setEditing({ ...editing, fromDry: !editing.fromDry })} />
                      <Chip label="Fürs Training" on={editing.training} onPress={() => setEditing({ ...editing, training: !editing.training })} />
                    </View>
                  </>
                ) : null}
                {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
                <ButtonRow
                  side={[editing.item ? <TrashButton key="trash" label="Entfernen" onPress={() => remove(editing)} /> : null, <BigButton key="no" kind="side" size="m" label="Abbrechen" onPress={() => setEditing(null)} />]}
                  main={<BigButton kind="training" size="m" icon={editing.item ? "check" : "add"} label={editing.item ? "Speichern" : "Hinzufügen"} disabled={!editing.name.trim()} onPress={() => save(editing)} />}
                />
              </View>
            ) : null}
          </Sheet>
        </>
      }
      bottom={
        what === "exercise" ? (
          <BigButton kind="training" size="m" icon="add" label="Übung dazu" onPress={() => open({ what: "exercise", item: null, name: "" })} />
        ) : (
          <BigButton kind="training" size="m" icon="add" label="Leckerli dazu" onPress={() => open(newTreat)} />
        )
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
});
