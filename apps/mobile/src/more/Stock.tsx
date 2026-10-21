// Vorrat: what is left of the wet and the dry food and how long it lasts (from the server, worked out by the domain)
// on top; at the bottom what was bought (Eingekauft: cans × grams per can, or grams) or what is there when counted by
// hand (Nachgezählt), then Eintragen.
import type { FoodKind } from "@gassi/domain";
import { stockParts } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Segments } from "../ui/Segments";
import { useBack } from "./back";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Mode = "restock" | "count";
const KINDS = [
  { value: "wet", label: "Nass" },
  { value: "dry", label: "Trocken" },
] as const;
const MODES = [
  { value: "restock", label: "Eingekauft" },
  { value: "count", label: "Nachgezählt" },
] as const;

export function Stock() {
  const theme = useTheme();
  const back = useBack();
  const { api } = useGassi();
  const { data: stock, error, reload } = useServer((a) => a.stock());
  const { message, run } = useWrite();
  const [kind, setKind] = useState<FoodKind>("wet");
  const [mode, setMode] = useState<Mode>("restock");
  const [amount, setAmount] = useState("");
  // the can size starts as the last one bought
  const [unit, setUnit] = useState<string | null>(null);
  const unitG = unit ?? (stock?.wet.canSizeG ? String(stock.wet.canSizeG) : "");

  const save = () =>
    void run(async () => {
      if (!api) return;
      if (mode === "restock") await api.restock(kind === "wet" ? { foodKind: "wet", cans: amount, unitG } : { foodKind: "dry", grams: amount });
      else await api.correctStock(kind === "wet" ? { foodKind: "wet", cans: amount.replace(",", ".") } : { foodKind: "dry", grams: amount });
      setAmount("");
      reload();
    }, "Eingetragen.");

  const card = (k: FoodKind, title: string) => {
    const s = stock ? stockParts(stock, k) : null;
    const big = !s ? "…" : s.empty ? "aufgebraucht" : (s.left ?? "unbekannt");
    const lines = [
      s?.lasts,
      s?.empty ? "Stimmt das nicht? Unten nachzählen." : null,
      s && !s.empty && s.left === null ? "Trag einen Einkauf ein oder zähl nach." : null,
      k === "wet" && stock?.wet.canSizeG ? `Dosen à ${stock.wet.canSizeG} g` : null,
    ].filter(Boolean);
    return (
      <View testID={`stock-${k}`} style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.small, { color: theme.muted }]}>{title}</Text>
        <Text style={[styles.big, { color: theme.ink }]}>{big}</Text>
        {lines.map((l) => (
          <Text key={l} style={[styles.small, { color: theme.muted }]}>
            {l}
          </Text>
        ))}
      </View>
    );
  };

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
          <Segments options={KINDS} value={kind} onChange={setKind} kind="food" />
          <Segments options={MODES} value={mode} onChange={setMode} />
          <View style={styles.fields}>
            {kind === "wet" ? (
              <>
                <Field label="Dosen" value={amount} onChangeText={setAmount} inputMode="decimal" keyboardType="decimal-pad" />
                {mode === "restock" ? <Field label="Gramm pro Dose" value={unitG} onChangeText={setUnit} inputMode="numeric" keyboardType="number-pad" /> : null}
              </>
            ) : (
              <Field label="Gramm" value={amount} onChangeText={setAmount} inputMode="numeric" keyboardType="number-pad" />
            )}
          </View>
          <BigButton kind="food" size="l" label="Eintragen" disabled={!amount.trim()} onPress={save} />
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
  fields: { flexDirection: "row", gap: 8 },
  message: { fontSize: 15, fontWeight: "600" },
});
