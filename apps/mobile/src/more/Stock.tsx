// Vorrat: what is left of the wet food (per can size, with the total) and of the dry food, and how long it lasts
// (from the server, worked out by the domain) on top; at the bottom what was bought (Eingekauft) or what is there when
// counted by hand (Nachgezählt), the same way in both: wet food one row per can size with − and + (bought: whole cans
// from 0; counted: from what the stock says, in halves for an opened can), a row of another
// size added with "+ Dosengröße" ("Dosen à [ ] g"; one without grams isn't recorded). × buying hides that size from
// the purchase rows on this phone (the stock stays); counting it sets the size to 0, which retires it on Eintragen; on
// an added row it just drops it. Dry food is one amount in g or kg. One Eintragen records it all.
import type { DryUnit, FoodKind } from "@gassi/domain";
import { buyingSizes, formatCans, formSizes, type HiddenSize, parseCanSize, parseDecimal, stockParts } from "@gassi/domain";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { FOOD_KIND_OPTIONS } from "../ui/foodKinds";
import { Segments } from "../ui/Segments";
import { StepButton } from "../ui/Stepper";
import { TapToEdit } from "../ui/TapToEdit";
import { useGassi } from "../data/GassiProvider";
import { useServer } from "./useServer";
import { loadHidden, saveHidden } from "./hidden";
import { useWrite } from "./useWrite";

type Mode = "restock" | "count";
const MODES = [
  { value: "restock", label: "Eingekauft" },
  { value: "count", label: "Nachgezählt" },
] as const;
const UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
] as const;
const MAX_CANS = 1000;

/** A number of cans as the count field shows it: "2,75", "3". */
const decimalText = (n: number): string => n.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });


export function Stock() {
  const theme = useTheme();
  const { data: stock, error, reload } = useServer((a) => a.stock());
  const { message, setMessage, run } = useWrite();
  const { me } = useGassi();
  const [kind, setKind] = useState<FoodKind>("wet");
  const [mode, setMode] = useState<Mode>("restock");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<DryUnit>("kg"); // dry food: sacks in kg, the rest of one maybe in g
  // wet food: one row per known can size, and one per size added ("+ Dosengröße"); every row's size can be edited (a
  // row counts by its size as it reads on Eintragen). Bought counts start at 0 in whole cans; counted ones at what the
  // stock says and can be typed freely ("2,75"; the domain checks them), − and + step by ½; sizes and counts read as text
// and turn into a field when tapped
  const known = stock?.wet.sizes.map((s) => s.unitG) ?? [];
  const [extras, setExtras] = useState(0); // how many rows were added
  const [edits, setEdits] = useState<Record<string, { size?: string; cans?: string }>>({});
  const [removed, setRemoved] = useState<string[]>([]); // rows taken away with × in this form
  // Eingekauft: sizes hidden from the purchase rows on this phone (Ruling Z); the stock doesn't change. Counting, × sets
  // the size to 0 for this count (it is in no row), and Eintragen retires it.
  const personId = me?.id ?? "";
  // read anew for another person (the state belongs to the person it was read for)
  const [kept, setKept] = useState<{ personId: string; hidden: HiddenSize[] }>(() => ({ personId, hidden: loadHidden(personId) }));
  const hidden = kept.personId === personId ? kept.hidden : loadHidden(personId);
  const offered = mode === "restock" && stock ? buyingSizes(stock, hidden) : known;
  const removeRow = (key: string) => {
    if (mode === "restock" && key.startsWith("k")) {
      const unitG = Number(key.slice(1));
      // remembered with the size's last purchase or count as the server told it, not the phone's clock
      const next = [...hidden.filter((h) => h.unitG !== unitG), { unitG, seenLastAt: stock?.wet.sizes.find((x) => x.unitG === unitG)?.lastAt ?? null }];
      setKept({ personId, hidden: next });
      saveHidden(personId, next);
    } else setRemoved([...removed, key]);
  };
  const rows = [
    ...offered.map((u) => ({ key: `k${u}`, size: String(u), cans: decimalText(mode === "count" ? (stock?.wet.sizes.find((s) => s.unitG === u)?.cans ?? 0) : 0) })),
    ...Array.from({ length: extras }, (_, i) => ({ key: `x${i}`, size: "", cans: "0" })),
  ]
    .filter((r) => !removed.includes(r.key))
    .map((r) => ({ ...r, ...edits[r.key] }));
  const edit = (key: string, change: { size?: string; cans?: string }) => setEdits({ ...edits, [key]: { ...edits[key], ...change } });
  // what Eintragen sends (Ruling X, in the domain): rows by their sizes; counting, a known size in no row is 0
  const { sizes, unsized } = formSizes(known, rows, mode === "count");

  // a message is about what was entered, and the rows are for one mode: both go when the form changes
  const reset = () => {
    setMessage(null);
    setEdits({});
    setExtras(0);
    setRemoved([]);
    setAmount("");
  };
  const pickKind = (k: FoodKind) => {
    setKind(k);
    reset();
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  const ready = kind === "dry" ? !!amount.trim() : mode === "restock" ? sizes.some((s) => parseDecimal(s.cans) > 0) : sizes.length > 0;
  const save = () =>
    void run(async (api) => {
      if (kind === "dry") {
        if (mode === "restock") await api.restock({ foodKind: "dry", amount, unit });
        else await api.correctStock({ foodKind: "dry", amount, unit });
      } else if (mode === "restock") await api.restock({ foodKind: "wet", sizes: sizes.map((s) => ({ unitG: s.unitG, cans: parseDecimal(s.cans) || 0 })) });
      else await api.correctStock({ foodKind: "wet", sizes });
      setAmount("");
      setEdits({});
      setExtras(0);
      setRemoved([]);
      reload();
    }, "Eingetragen.");

  const card = (k: FoodKind, title: string) => {
    const s = stock ? stockParts(stock, k) : null;
    const big = !s ? ["…"] : s.empty ? ["aufgebraucht"] : s.sizes.length ? s.sizes : [s.left ?? "unbekannt"];
    const lines = [
      s?.total,
      s?.lasts,
      s?.empty ? "Stimmt das nicht? Unten nachzählen." : null,
      s && !s.empty && s.left === null ? "Trag einen Einkauf ein oder zähl nach." : null,
    ].filter(Boolean);
    return (
      <View testID={`stock-${k}`} style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.small, { color: theme.muted }]}>{title}</Text>
        {big.map((b) => (
          <Text key={b} style={[styles.big, { color: theme.ink }]}>
            {b}
          </Text>
        ))}
        {lines.map((l) => (
          <Text key={l} style={[styles.small, { color: theme.muted }]}>
            {l}
          </Text>
        ))}
      </View>
    );
  };

  const wet = (
    <>
      {rows.map((r) => {
        const unitG = parseCanSize(r.size);
        const n = parseDecimal(r.cans) || 0;
        const name = unitG ? `à ${unitG} g` : "neuer Größe";
        const change = (d: number) => edit(r.key, { cans: decimalText(Math.min(MAX_CANS, Math.max(0, n + d))) });
        const step = mode === "count" ? 0.5 : 1; // counted: halves (an opened can); bought: whole cans
        const what = mode === "count" ? "½ Dose" : "1 Dose";
        // a known size's row keeps its id while its size is edited; an added one is named by the size typed
        const id = r.key.startsWith("k") ? r.key.slice(1) : (unitG ?? "new");
        return (
          <View key={r.key} testID={`count-${id}`} style={[styles.row, { backgroundColor: theme.surface }]}>
            <View style={styles.rowField}>
              <Text style={[styles.labelText, { color: theme.muted }]}>Dosen à</Text>
              <TapToEdit
                label="Dosengröße in Gramm"
                value={r.size}
                onChange={(size) => edit(r.key, { size })}
                startEditing={r.key.startsWith("x")}
                warn={!unitG}
                inputMode="numeric"
                keyboardType="number-pad"
                width={56}
                style={styles.gramValue}
              />
              <Text style={[styles.labelText, { color: theme.muted }]}>g</Text>
            </View>
            <StepButton small label={`${what} ${name} weniger`} sign="−" disabled={n <= 0} onPress={() => change(-step)} />
            {mode === "count" ? (
              <TapToEdit testID={`count-${id}-value`} label={`Anzahl Dosen ${name}`} value={r.cans} onChange={(cans) => edit(r.key, { cans })} inputMode="decimal" keyboardType="decimal-pad" style={styles.rowValue} width={72} />
            ) : (
              <Text testID={`count-${id}-value`} style={[styles.rowValue, { color: theme.ink }]}>
                {formatCans(n)}
              </Text>
            )}
            <StepButton small label={`${what} ${name} mehr`} sign="+" disabled={n >= MAX_CANS} onPress={() => change(step)} />
            <Pressable accessibilityRole="button" accessibilityLabel="Dosengröße entfernen" hitSlop={8} onPress={() => removeRow(r.key)} style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[styles.removeText, { color: theme.muted }]}>×</Text>
            </Pressable>
          </View>
        );
      })}
      {unsized ? (
        <Text testID="stock-unsized" style={[styles.small, { color: theme.muted }]}>
          {unsized === 1 ? "Eine Zeile ohne Dosengröße wird nicht eingetragen." : `${unsized} Zeilen ohne Dosengröße werden nicht eingetragen.`}
        </Text>
      ) : null}
      <BigButton kind="neutral" size="m" label="+ Dosengröße" a11y="Dosengröße hinzufügen" onPress={() => setExtras(extras + 1)} />
    </>
  );

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Vorrat</Text>
          {error && !stock ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          <View style={styles.cards}>
            {card("wet", "Nassfutter")}
            {card("dry", "Trockenfutter")}
          </View>
        </>
      }
      bottom={
        <>
          {message ? (
            <Text testID="stock-message" style={[styles.message, { color: theme.ink }]}>
              {message}
            </Text>
          ) : null}
          <Segments options={FOOD_KIND_OPTIONS} value={kind} onChange={pickKind} kind="food" />
          <Segments options={MODES} value={mode} onChange={pickMode} />
          {kind === "wet" ? (
            wet
          ) : (
            <View style={styles.fields}>
              <Field label="Menge" value={amount} onChangeText={setAmount} inputMode="decimal" keyboardType="decimal-pad" />
              <View style={styles.unit}>
                <Segments options={UNITS} value={unit} onChange={setUnit} />
              </View>
            </View>
          )}
          <BigButton kind="food" size="l" icon="check" label="Eintragen" disabled={!ready} onPress={save} />
        </>
      }
      topMin={150}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  cards: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderRadius: radius.tile, padding: 12, gap: 2 },
  big: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  fields: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  unit: { width: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.tile, paddingVertical: 6, paddingHorizontal: 12 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  rowField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  labelText: { fontSize: 14, fontWeight: "600" },
  remove: { width: 24, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 20, fontWeight: "700" },
  gramValue: { textAlign: "right" },
  rowValue: { minWidth: 72, textAlign: "center", fontSize: 16, fontWeight: "700" },
  message: { fontSize: 15, fontWeight: "600" },
});
