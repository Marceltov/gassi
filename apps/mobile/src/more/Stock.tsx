// Vorrat: what is left of the wet food (per can size, with the total) and of the dry food, and how long it lasts
// (from the server, worked out by the domain) on top; at the bottom what was bought (Eingekauft) or what is there when
// counted by hand (Nachgezählt), the same way in both: wet food one row per can size with − and + (bought: whole cans
// from 0; counted: from what the stock says, in halves for an opened can), a row of another
// size added with "+ Dosengröße" (its grams typed in the row; one without grams isn't recorded); dry food one amount in
// g or kg. One Eintragen records it all.
import type { DryUnit, FoodKind } from "@gassi/domain";
import { formatCans, stockParts } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { FOOD_KIND_OPTIONS } from "../ui/foodKinds";
import { Segments } from "../ui/Segments";
import { StepButton } from "../ui/Stepper";
import { useBack } from "./back";
import { useServer } from "./useServer";
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

/** A whole number of grams per can typed in, else null. */
const typedSize = (v: string): number | null => (/^\d{1,5}$/.test(v.trim()) && Number(v) > 0 ? Number(v) : null);

export function Stock() {
  const theme = useTheme();
  const back = useBack();
  const { data: stock, error, reload } = useServer((a) => a.stock());
  const { message, setMessage, run } = useWrite();
  const [kind, setKind] = useState<FoodKind>("wet");
  const [mode, setMode] = useState<Mode>("restock");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<DryUnit>("kg"); // dry food: sacks in kg, the rest of one maybe in g
  // wet food: one row per known can size, and one per size typed in ("+ Dosengröße"); bought counts start at 0 in
  // whole cans, counted ones at what the stock says, in halves
  const known = stock?.wet.sizes.map((s) => s.unitG) ?? [];
  const [extras, setExtras] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const step = mode === "restock" ? 1 : 0.5;
  const rows = [
    ...known.map((u) => ({ key: `k${u}`, unitG: u as number | null, extra: null as number | null })),
    ...extras.map((text, i) => ({ key: `x${i}`, unitG: typedSize(text), extra: i })),
  ];
  const countOf = (key: string, unitG: number | null) => counts[key] ?? (mode === "count" && unitG ? (stock?.wet.sizes.find((s) => s.unitG === unitG)?.cans ?? 0) : 0);
  const sized = rows.flatMap((r) => (r.unitG ? [{ unitG: r.unitG, cans: countOf(r.key, r.unitG) }] : []));
  const sizes = [...new Map(sized.map((s) => [s.unitG, s])).values()]; // a typed size that is known already counts once

  // a message is about what was entered, and the rows are for one mode: both go when the form changes
  const reset = () => {
    setMessage(null);
    setCounts({});
    setExtras([]);
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

  const ready = kind === "dry" ? !!amount.trim() : mode === "restock" ? sizes.some((s) => s.cans > 0) : sizes.length > 0;
  const save = () =>
    void run(async (api) => {
      if (kind === "dry") {
        if (mode === "restock") await api.restock({ foodKind: "dry", amount, unit });
        else await api.correctStock({ foodKind: "dry", amount, unit });
      } else if (mode === "restock") await api.restock({ foodKind: "wet", sizes });
      else await api.correctStock({ foodKind: "wet", sizes });
      setAmount("");
      setCounts({});
      setExtras([]);
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
        const n = countOf(r.key, r.unitG);
        const name = r.unitG ? `à ${r.unitG} g` : "neuer Größe";
        const change = (d: number) => setCounts({ ...counts, [r.key]: Math.min(MAX_CANS, Math.max(0, n + d)) });
        const what = step === 1 ? "1 Dose" : "½ Dose";
        return (
          <View key={r.key} testID={r.unitG ? `count-${r.unitG}` : undefined} style={[styles.row, { backgroundColor: theme.surface }]}>
            {r.extra === null ? (
              <Text style={[styles.rowLabel, { color: theme.muted }]}>Dosen à {r.unitG} g</Text>
            ) : (
              <View style={styles.rowField}>
                <TextInput
                  accessibilityLabel="Gramm pro Dose"
                  value={extras[r.extra]}
                  onChangeText={(v) => setExtras(extras.map((x, i) => (i === r.extra ? v : x)))}
                  placeholder="…"
                  placeholderTextColor={theme.muted}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  autoFocus
                  style={[styles.gramInput, { color: theme.ink, borderColor: theme.line, backgroundColor: theme.background }]}
                />
                <Text style={[styles.rowLabel, { color: theme.muted }]}>g</Text>
              </View>
            )}
            <StepButton small label={`${what} ${name} weniger`} sign="−" disabled={n <= 0} onPress={() => change(-step)} />
            <Text testID={r.unitG ? `count-${r.unitG}-value` : undefined} style={[styles.rowValue, { color: theme.ink }]}>
              {formatCans(n)}
            </Text>
            <StepButton small label={`${what} ${name} mehr`} sign="+" disabled={n >= MAX_CANS} onPress={() => change(step)} />
          </View>
        );
      })}
      <BigButton kind="neutral" size="m" label="+ Dosengröße" a11y="Dosengröße hinzufügen" onPress={() => setExtras([...extras, ""])} />
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
          <BigButton kind="food" size="l" label="Eintragen" disabled={!ready} onPress={save} />
          <BigButton kind="neutral" size="m" label="Zurück" onPress={back} />
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.tile, paddingVertical: 6, paddingHorizontal: 12 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  rowField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  gramInput: { width: 72, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, fontWeight: "600" },
  rowValue: { minWidth: 84, textAlign: "center", fontSize: 16, fontWeight: "700" },
  message: { fontSize: 15, fontWeight: "600" },
});
