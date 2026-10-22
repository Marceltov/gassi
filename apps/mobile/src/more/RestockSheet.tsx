// Vorrat's "Eingekauft" (#73): what was bought, in a sheet. Wet food one row per can size with − and + in whole cans
// from 0, a row of another size added with "+ andere Dosengröße" ("Dosen à [ ] g"). A row without grams holds up the
// button until its grams are typed or it is taken away with ×. × on a known size hides it from these rows on this
// phone (Ruling Z; the stock stays), on an added row it just drops it. Dry food is one amount in g or kg. The button
// says what it records ("6 Dosen eintragen").
import type { DryUnit, FoodKind, Stock } from "@gassi/domain";
import { buyingSizes, formatCans, formSizes, type HiddenSize, parseCanSize, parseDecimal } from "@gassi/domain";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { FOOD_KIND_OPTIONS } from "../ui/foodKinds";
import { Segments } from "../ui/Segments";
import { Sheet } from "../ui/Sheet";
import { StepButton } from "../ui/Stepper";
import { TapToEdit } from "../ui/TapToEdit";
import { useGassi } from "../data/GassiProvider";
import { loadHidden, saveHidden } from "./hidden";
import { useWrite } from "./useWrite";

const UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
] as const;
const MAX_CANS = 1000;

/** `onDone`: after a purchase was recorded (Vorrat reloads and says so). */
export function RestockSheet({ open, onClose, onDone, stock }: { open: boolean; onClose: () => void; onDone: () => void; stock: Stock | null }) {
  return (
    <Sheet open={open} onClose={onClose} label="Eingekauft">
      {open ? <RestockForm onDone={onDone} stock={stock} /> : null}
    </Sheet>
  );
}

function RestockForm({ onDone, stock }: { onDone: () => void; stock: Stock | null }) {
  const theme = useTheme();
  const { me } = useGassi();
  const { message, setMessage, run } = useWrite();
  const [kind, setKind] = useState<FoodKind>("wet");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<DryUnit>("kg"); // dry food: sacks in kg, the rest of one maybe in g
  const [extras, setExtras] = useState(0); // how many rows were added
  const [edits, setEdits] = useState<Record<string, { size?: string; cans?: number }>>({});
  const [removed, setRemoved] = useState<string[]>([]); // added rows taken away with ×
  const personId = me?.id ?? "";
  // read anew for another person (the state belongs to the person it was read for)
  const [kept, setKept] = useState<{ personId: string; hidden: HiddenSize[] }>(() => ({ personId, hidden: loadHidden(personId) }));
  const hidden = kept.personId === personId ? kept.hidden : loadHidden(personId);
  const known = stock?.wet.sizes.map((s) => s.unitG) ?? [];
  const offered = stock ? buyingSizes(stock, hidden) : [];
  const rows = [
    ...offered.map((u) => ({ key: `k${u}`, size: String(u), cans: 0 })),
    ...Array.from({ length: extras }, (_, i) => ({ key: `x${i}`, size: "", cans: 0 })),
  ]
    .filter((r) => !removed.includes(r.key))
    .map((r) => ({ ...r, ...edits[r.key] }));
  const remove = (key: string) => {
    if (key.startsWith("k")) {
      const unitG = Number(key.slice(1));
      // remembered with the size's last purchase or count as the server told it, not the phone's clock
      const next = [...hidden.filter((h) => h.unitG !== unitG), { unitG, seenLastAt: stock?.wet.sizes.find((x) => x.unitG === unitG)?.lastAt ?? null }];
      setKept({ personId, hidden: next });
      saveHidden(personId, next);
    } else setRemoved([...removed, key]);
  };
  // from the edits as they are when React applies them, so quick taps in a row each count
  const step = (key: string, d: number) => setEdits((e) => ({ ...e, [key]: { ...e[key], cans: Math.min(MAX_CANS, Math.max(0, (e[key]?.cans ?? 0) + d)) } }));
  // what the button sends (Ruling X, in the domain): rows by their sizes; sizes left at 0 stay out
  const { sizes, unsized } = formSizes(known, rows, false);
  const bought = sizes.flatMap((s) => (typeof s.cans === "number" && s.cans > 0 ? [{ unitG: s.unitG, cans: s.cans }] : []));
  const cans = bought.reduce((n, s) => n + s.cans, 0);
  const dry = parseDecimal(amount);

  const pickKind = (k: FoodKind) => {
    setKind(k);
    setMessage(null);
  };
  const ready = kind === "dry" ? dry > 0 : !unsized && cans > 0;
  const label = kind === "dry" ? (dry > 0 ? `${amount.trim()} ${unit} eintragen` : "Eintragen") : cans > 0 ? `${formatCans(cans)} eintragen` : "Eintragen";
  const save = () =>
    void run(async (api) => {
      if (kind === "dry") await api.restock({ foodKind: "dry", amount, unit });
      else await api.restock({ foodKind: "wet", sizes: bought });
    }).then((ok) => ok && onDone());

  return (
    <View style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>Eingekauft</Text>
      <Segments options={FOOD_KIND_OPTIONS} value={kind} onChange={pickKind} kind="food" />
      {kind === "wet" ? (
        <>
          <ScrollView style={styles.rows} contentContainerStyle={styles.gap}>
            {rows.map((r) => {
              const unitG = parseCanSize(r.size);
              const name = unitG ? `à ${unitG} g` : "neuer Größe";
              // a known size's row keeps its id; an added one is named by the size typed
              const id = r.key.startsWith("k") ? r.key.slice(1) : (unitG ?? "new");
              return (
                <View key={r.key} testID={`buy-${id}`} style={[styles.row, { backgroundColor: theme.surface, borderColor: unitG ? "transparent" : theme.danger }]}>
                  <View style={styles.rowField}>
                    <Text style={[styles.labelText, { color: theme.muted }]}>Dosen à</Text>
                    {r.key.startsWith("x") ? (
                      <TapToEdit label="Dosengröße in Gramm" value={r.size} onChange={(size) => setEdits((e) => ({ ...e, [r.key]: { ...e[r.key], size } }))} startEditing warn={!unitG} inputMode="numeric" keyboardType="number-pad" width={56} style={styles.gramValue} />
                    ) : (
                      <Text style={[styles.size, { color: theme.ink }]}>{r.size}</Text>
                    )}
                    <Text style={[styles.labelText, { color: theme.muted }]}>g</Text>
                  </View>
                  <StepButton small label={`1 Dose ${name} weniger`} sign="−" disabled={r.cans <= 0} onPress={() => step(r.key, -1)} />
                  <Text testID={`buy-${id}-value`} style={[styles.value, { color: theme.ink }]}>
                    {r.cans}
                  </Text>
                  <StepButton small label={`1 Dose ${name} mehr`} sign="+" disabled={r.cans >= MAX_CANS} onPress={() => step(r.key, 1)} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Dosengröße entfernen" hitSlop={8} onPress={() => remove(r.key)} style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.removeText, { color: theme.muted }]}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          {unsized ? (
            <Text testID="buy-unsized" style={[styles.warn, { color: theme.danger }]}>
              {`${unsized === 1 ? "Eine Zeile hat" : `${unsized} Zeilen haben`} keine Dosengröße: Gramm eintragen oder mit × entfernen.`}
            </Text>
          ) : null}
          <BigButton kind="neutral" size="s" label="+ andere Dosengröße" a11y="Dosengröße hinzufügen" onPress={() => setExtras(extras + 1)} />
        </>
      ) : (
        <View style={styles.fields}>
          <Field label="Menge" value={amount} onChangeText={setAmount} inputMode="decimal" keyboardType="decimal-pad" />
          <View style={styles.unit}>
            <Segments options={UNITS} value={unit} onChange={setUnit} />
          </View>
        </View>
      )}
      {message ? (
        <Text testID="buy-message" style={[styles.message, { color: theme.ink }]}>
          {message}
        </Text>
      ) : null}
      <BigButton kind="food" size="m" icon="check" label={label} disabled={!ready} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, flexShrink: 1, minHeight: 0 },
  title: { fontSize: 20, fontWeight: "700" },
  rows: { flexShrink: 1, minHeight: 0 },
  gap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.tile, borderWidth: 2, paddingVertical: 4, paddingHorizontal: 10 },
  rowField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  labelText: { fontSize: 14, fontWeight: "600" },
  size: { fontSize: 16, fontWeight: "700" },
  gramValue: { textAlign: "right" },
  value: { minWidth: 40, textAlign: "center", fontSize: 16, fontWeight: "700" },
  remove: { width: 24, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 20, fontWeight: "700" },
  warn: { fontSize: 14, fontWeight: "700" },
  fields: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  unit: { width: 120 },
  message: { fontSize: 15, fontWeight: "600" },
});
