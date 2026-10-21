// Hunde: the household's dogs, archived ones below (their past entries stay; they aren't offered for new ones). A tap
// opens a dog to rename it, give it another color, archive it or bring it back; Hund hinzufügen at the bottom.
import type { Client } from "@gassi/api-client";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import type { Dog } from "../data/store";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { Group, Row } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

const COLORS = ["#b8691a", "#8a5a1f", "#2e7d4f", "#3b5ba5", "#7a5ab8", "#a33b5b", "#b08a16", "#5f6670"];

type Editing = { dog: Dog | null; name: string; color: string };

export function Dogs() {
  const theme = useTheme();
  const { refresh } = useGassi();
  const { data, error, reload } = useServer((a) => a.dogs({ archived: "1" }));
  const { message, setMessage, run } = useWrite();
  const [editing, setEditing] = useState<Editing | null>(null);
  const dogs = data?.dogs ?? [];

  const open = (dog: Dog | null) => {
    setMessage(null);
    setEditing({ dog, name: dog?.name ?? "", color: dog?.color ?? COLORS[dogs.length % COLORS.length] });
  };
  const change = async (call: (api: Client) => Promise<unknown>) => {
    if (await run(call)) {
      setEditing(null);
      reload();
      void refresh(); // the other screens offer the dogs anew
    }
  };
  const save = (e: Editing) =>
    void change(async (api) => {
      if (e.dog) await api.updateDog({ id: e.dog.id, name: e.name, color: e.color });
      else await api.addDog({ name: e.name, color: e.color });
    });
  const archive = (dog: Dog, archived: boolean) => void change((api) => api.updateDog({ id: dog.id, archived }));

  const rows = (list: Dog[]) => list.map((d) => <Row key={d.id} testID={`dog-${d.name}`} label={d.name} dot={d.color} onPress={() => open(d)} />);
  const active = dogs.filter((d) => !d.archived);
  const archived = dogs.filter((d) => d.archived);

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Hunde</Text>
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          {active.length ? <Group>{rows(active)}</Group> : null}
          {archived.length ? <Group title="Archiviert">{rows(archived)}</Group> : null}
          <Sheet open={!!editing} onClose={() => setEditing(null)} label={editing ? (editing.dog ? editing.dog.name : "Neuer Hund") : undefined}>
            {editing ? (
              <View testID="dog-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{editing.dog ? editing.dog.name : "Neuer Hund"}</Text>
                <Field label="Name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} autoFocus={!editing.dog} />
                <View accessibilityRole="radiogroup" accessibilityLabel="Farbe" style={styles.colors}>
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      accessibilityRole="radio"
                      accessibilityLabel={`Farbe ${c}`}
                      accessibilityState={{ checked: editing.color === c }}
                      onPress={() => setEditing({ ...editing, color: c })}
                      style={[styles.swatch, { backgroundColor: c, borderColor: editing.color === c ? theme.ink : "transparent" }]}
                    />
                  ))}
                </View>
                {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
                <BigButton kind="walk" size="l" icon={editing.dog ? "check" : "add"} label={editing.dog ? "Speichern" : "Hinzufügen"} disabled={!editing.name.trim()} onPress={() => save(editing)} />
                {editing.dog ? (
                  <BigButton kind="neutral" size="m" label={editing.dog.archived ? "Zurückholen" : "Archivieren"} onPress={() => editing.dog && archive(editing.dog, !editing.dog.archived)} />
                ) : null}
                <BigButton kind="neutral" size="m" label="Abbrechen" onPress={() => setEditing(null)} />
              </View>
            ) : null}
          </Sheet>
        </>
      }
      bottom={
        <>
          <BigButton kind="walk" size="l" icon="add" label="Hund hinzufügen" onPress={() => open(null)} />
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
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  message: { fontSize: 15, fontWeight: "600" },
});
