// Vorrat (#73): on top a card per kind with the amount and how long it lasts (from the server, worked out by the
// domain); below the stock as a list you count in, right above the controls: wet food one row per can size with − and
// + in whole closed cans (an open can isn't counted, ADR 0011; a typed 2,85 steps to 3 or 2 first), dry food one row in
// kg in halves; a count can also be typed, and a size's grams corrected (Ruling X: 10000 corrected to 1000 retires
// 10000). A count changes nothing until "Zählung speichern" (one count per kind, every size at once; a size counted to
// 0 is retired); until then the new number shows in orange with the old one under it, the card too, and "Verwerfen"
// takes it back. What was bought goes in through "+ Eingekauft" (RestockSheet): wet stock is the last count plus what
// was bought since minus the cans opened since, dry stock minus what was fed since.
import type { FoodKind } from "@gassi/domain";
import { countWeight, formatWeight, formSizes, parseCanSize, parseDecimal, stockParts } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Screen } from "../ui/Screen";
import { StepButton } from "../ui/Stepper";
import { TapToEdit } from "../ui/TapToEdit";
import { RestockSheet } from "./RestockSheet";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

const MAX = 1000;

/** A count as its field shows it: "2,75", "3". */
const decimalText = (n: number): string => n.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });

export function Stock() {
  const theme = useTheme();
  const { data: stock, error, reload } = useServer((a) => a.stock());
  const { message, setMessage, run } = useWrite();
  const [buying, setBuying] = useState(false);
  // what was changed by counting, by row ("k400" a can size, "dry" the dry food): a size's grams and its count as text
  const [edits, setEdits] = useState<Record<string, { size?: string; cans?: string }>>({});
  // a saved count stays on screen until the stock read after it arrives, so the old numbers don't flash up in between
  const [savedOver, setSavedOver] = useState<typeof stock>(null);
  if (savedOver && stock !== savedOver) {
    setSavedOver(null);
    setEdits({});
  }
  const known = stock?.wet.sizes ?? [];
  const wetRows = known.map((s) => ({ key: `k${s.unitG}`, unitG: s.unitG, was: decimalText(s.cans), size: String(s.unitG), cans: decimalText(s.cans), ...edits[`k${s.unitG}`] }));
  const dryWas = stock?.dry.grams == null ? "0" : decimalText(Math.max(0, stock.dry.grams) / 1000);
  const dryCount = edits.dry?.cans ?? dryWas;
  const wetChanged = wetRows.some((r) => r.cans !== r.was || r.size !== String(r.unitG));
  const dryChanged = dryCount !== dryWas;
  const changed = wetChanged || dryChanged;
  // what saving sends (Ruling X, in the domain): every row by its size as it now reads, a size no row has any more is 0
  const { sizes, unsized } = formSizes(
    known.map((s) => s.unitG),
    wetRows,
    true,
  );

  const edit = (key: string, change: { size?: string; cans?: string }) => {
    setMessage(null);
    setEdits((e) => ({ ...e, [key]: { ...e[key], ...change } }));
  };
  // from the edits as they are when React applies them, so quick taps in a row each count; a typed 11,85 goes to the
  // nearest step first (wet: 12 or 11; dry: 12 or 11,5), then on in steps: whole cans, half kilos
  const step = (key: string, from: string, up: boolean) => {
    setMessage(null);
    const per = key === "dry" ? 2 : 1; // steps per unit
    setEdits((e) => {
      const steps = (parseDecimal(e[key]?.cans ?? from) || 0) * per;
      const next = (up ? Math.floor(steps + 1e-9) + 1 : Math.ceil(steps - 1e-9) - 1) / per;
      return { ...e, [key]: { ...e[key], cans: decimalText(Math.min(MAX, Math.max(0, next))) } };
    });
  };
  const save = () =>
    void run(async (api) => {
      if (wetChanged) await api.correctStock({ foodKind: "wet", sizes });
      if (dryChanged) await api.correctStock({ foodKind: "dry", amount: dryCount, unit: "kg" });
      if (stock) setSavedOver(stock);
      else setEdits({});
      reload();
    });

  const card = (k: FoodKind, title: string) => {
    const s = stock ? stockParts(stock, k) : null;
    // while counting, what the count comes to
    const counted = k === "wet" ? (wetChanged ? countWeight(sizes) : null) : dryChanged ? formatWeight((parseDecimal(dryCount) || 0) * 1000) : null;
    const amount = counted ?? (!s ? "…" : (s.amount ?? "unbekannt"));
    // always a third line, so both cards line up; without feedings since the last purchase or count there is nothing to go by
    const note = !s ? "…" : s.empty ? "aufgebraucht" : s.amount === null ? "noch nichts eingetragen" : (s.lasts ?? "reicht: noch unbekannt");
    return (
      <View testID={`stock-${k}`} style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.big, { color: counted ? theme.food : theme.ink }]} numberOfLines={1}>
          {amount}
        </Text>
        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
          {note}
        </Text>
      </View>
    );
  };

  /** A row you count in, named for screen readers by `name` ("Dosen à 400 g") and its steps by `what` ("1 Dose à 400
   * g"); `sizeField` for a can size (its grams can be corrected), none for the dry food. */
  const row = (key: string, name: string, what: string, was: string, value: string, sizeField?: { size: string; unitG: number | null }) => {
    const n = parseDecimal(value);
    const isChanged = value !== was;
    const id = key === "dry" ? "dry" : key.slice(1);
    return (
      <View key={key} testID={`count-${id}`} style={[styles.row, { backgroundColor: theme.surface, borderColor: sizeField && !sizeField.unitG ? theme.danger : "transparent" }]}>
        <View style={styles.rowField}>
          {sizeField ? (
            <>
              <Text style={[styles.labelText, { color: theme.muted }]}>Dosen à</Text>
              <TapToEdit label="Dosengröße in Gramm" value={sizeField.size} onChange={(size) => edit(key, { size })} warn={!sizeField.unitG} inputMode="numeric" keyboardType="number-pad" width={56} style={styles.gramValue} />
              <Text style={[styles.labelText, { color: theme.muted }]}>g</Text>
            </>
          ) : (
            <Text style={[styles.labelText, { color: theme.muted }]}>Menge in kg</Text>
          )}
        </View>
        <StepButton small label={`${what} weniger`} sign="−" disabled={!(n > 0)} onPress={() => step(key, was, false)} />
        <View style={styles.valueBox}>
          <TapToEdit testID={`count-${id}-value`} label={`Anzahl ${name}`} value={value} onChange={(cans) => edit(key, { cans })} inputMode="decimal" keyboardType="decimal-pad" style={isChanged ? { ...styles.value, color: theme.food } : styles.value} width={64} />
          {/* under the number; the two together sit in the middle, within the row's height */}
          {isChanged ? <Text style={[styles.was, { color: theme.muted }]}>{`vorher ${was}`}</Text> : null}
        </View>
        <StepButton small label={`${what} mehr`} sign="+" disabled={n >= MAX} onPress={() => step(key, was, true)} />
      </View>
    );
  };

  return (
    <Screen
      head={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Vorrat</Text>
          {error && !stock ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          <View style={styles.cards}>
            {card("wet", "Nassfutter")}
            {card("dry", "Trockenfutter")}
          </View>
        </>
      }
      top={
        <>
          <Text style={[styles.section, { color: theme.muted }]}>Nassfutter · geschlossene Dosen</Text>
          {wetRows.length ? (
            wetRows.map((r) => {
              const unitG = parseCanSize(r.size);
              const name = unitG ? `à ${unitG} g` : "neuer Größe";
              return row(r.key, `Dosen ${name}`, `1 Dose ${name}`, r.was, r.cans, { size: r.size, unitG });
            })
          ) : (
            <Text style={[styles.small, { color: theme.muted }]}>Noch keine Dosen: trag einen Einkauf ein.</Text>
          )}
          {unsized ? (
            <Text testID="stock-unsized" style={[styles.warn, { color: theme.danger }]}>
              {`${unsized === 1 ? "Eine Zeile hat" : `${unsized} Zeilen haben`} keine Dosengröße: Gramm eintragen.`}
            </Text>
          ) : null}
          <Text style={[styles.section, { color: theme.muted }]}>Trockenfutter</Text>
          {row("dry", "kg Trockenfutter", "½ kg Trockenfutter", dryWas, dryCount)}
        </>
      }
      low
      bottom={
        <>
          {message ? (
            <Text testID="stock-message" style={[styles.message, { color: theme.ink }]}>
              {message}
            </Text>
          ) : null}
          {changed ? (
            <ButtonRow side={[<BigButton key="undo" kind="side" size="m" label="Verwerfen" onPress={() => setEdits({})} />]} main={<BigButton kind="food" size="m" icon="check" label="Zählung speichern" disabled={unsized > 0} onPress={save} />} />
          ) : (
            <BigButton
              kind="food"
              size="m"
              label="+ Eingekauft"
              a11y="Eingekauft"
              onPress={() => {
                setMessage(null);
                setBuying(true);
              }}
            />
          )}
          <RestockSheet
            open={buying}
            onClose={() => setBuying(false)}
            stock={stock ?? null}
            onDone={() => {
              setBuying(false);
              reload();
            }}
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  cards: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderRadius: radius.tile, padding: 12, gap: 2 },
  big: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  section: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.tile, borderWidth: 2, paddingVertical: 4, paddingHorizontal: 10, minHeight: 52 },
  rowField: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  labelText: { fontSize: 14, fontWeight: "600" },
  gramValue: { textAlign: "right" },
  valueBox: { width: 64, alignItems: "center" },
  value: { textAlign: "center", fontSize: 16, fontWeight: "700" },
  was: { marginTop: -6, fontSize: 11, lineHeight: 12 },
  warn: { fontSize: 14, fontWeight: "700" },
  message: { fontSize: 15, fontWeight: "600" },
});
