// Vorrat: what is left of the wet food (per can size, with the total) and of the dry food, and how long it lasts
// (from the server, worked out by the domain) on top; at the bottom what was bought (Eingekauft: a can size and how
// many, or dry food in g or kg) or what is there when counted by hand (Nachgezählt: every can size at once, in halves
// for an opened can, or dry food in g or kg), then Eintragen.
import type { DryUnit, FoodKind } from "@gassi/domain";
import { formatCans, stockParts } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
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
const OTHER = "other";
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
  // the can size: one of the known ones (the last bought to start with) or another one typed in
  const known = stock?.wet.sizes.map((s) => s.unitG) ?? [];
  const [size, setSize] = useState<number | typeof OTHER | null>(null);
  const chosen = size ?? stock?.wet.newestUnitG ?? known.at(-1) ?? OTHER;
  const [other, setOther] = useState("");
  const otherG = typedSize(other);
  // a count per can size: what the stock says until changed here
  const [counts, setCounts] = useState<Record<number, number>>({});
  const countOf = (u: number) => counts[u] ?? stock?.wet.sizes.find((s) => s.unitG === u)?.cans ?? 0;
  const rows = [...known, ...(chosen === OTHER && otherG && !known.includes(otherG) ? [otherG] : [])];

  // a message is about what was entered: it goes when the form changes to something else
  const pickKind = (k: FoodKind) => {
    setKind(k);
    setMessage(null);
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    setMessage(null);
  };

  const restockUnit = chosen === OTHER ? otherG : chosen;
  const ready = kind === "dry" ? !!amount.trim() : mode === "restock" ? !!amount.trim() && restockUnit !== null : rows.length > 0;
  const save = () =>
    void run(async (api) => {
      if (kind === "dry") {
        if (mode === "restock") await api.restock({ foodKind: "dry", amount, unit });
        else await api.correctStock({ foodKind: "dry", amount, unit });
      } else if (mode === "restock") await api.restock({ foodKind: "wet", cans: amount, unitG: restockUnit ?? 0 });
      else await api.correctStock({ foodKind: "wet", sizes: rows.map((unitG) => ({ unitG, cans: countOf(unitG) })) });
      setAmount("");
      setCounts({});
      setOther("");
      setSize(null);
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

  const sizeChips = (
    <View style={styles.chips}>
      {(mode === "restock" ? known : []).map((u) => (
        <Chip key={u} label={`${u} g`} a11y={`Dosen à ${u} g`} on={chosen === u} onPress={() => setSize(u)} />
      ))}
      <Chip label="andere Größe" on={chosen === OTHER} onPress={() => setSize(chosen === OTHER && mode === "count" ? (known.at(-1) ?? OTHER) : OTHER)} />
    </View>
  );
  const otherField = chosen === OTHER ? <Field label="Gramm pro Dose" value={other} onChangeText={setOther} inputMode="numeric" keyboardType="number-pad" /> : null;

  const wet =
    mode === "restock" ? (
      <>
        <Text style={[styles.small, { color: theme.muted }]}>Dosengröße</Text>
        {sizeChips}
        <View style={styles.fields}>
          {otherField}
          <Field label="Dosen" value={amount} onChangeText={setAmount} inputMode="numeric" keyboardType="number-pad" />
        </View>
      </>
    ) : (
      <>
        {rows.map((u) => {
          const n = countOf(u);
          const step = (d: number) => setCounts({ ...counts, [u]: Math.min(MAX_CANS, Math.max(0, n + d)) });
          return (
            <View key={u} testID={`count-${u}`} style={[styles.row, { backgroundColor: theme.surface }]}>
              <Text style={[styles.rowLabel, { color: theme.muted }]}>Dosen à {u} g</Text>
              <StepButton small label={`½ Dose à ${u} g weniger`} sign="−" disabled={n <= 0} onPress={() => step(-0.5)} />
              <Text testID={`count-${u}-value`} style={[styles.rowValue, { color: theme.ink }]}>
                {formatCans(n)}
              </Text>
              <StepButton small label={`½ Dose à ${u} g mehr`} sign="+" disabled={n >= MAX_CANS} onPress={() => step(0.5)} />
            </View>
          );
        })}
        {sizeChips}
        {otherField}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.tile, paddingVertical: 6, paddingHorizontal: 12 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  rowValue: { minWidth: 84, textAlign: "center", fontSize: 16, fontWeight: "700" },
  message: { fontSize: 15, fontWeight: "600" },
});
