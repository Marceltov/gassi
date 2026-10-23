// The details of an entry kind as a form, made from their description in the domain (KIND_DETAILS, DETAILS): a text as a
// field (with earlier answers as chips), one choice as segments or chips, several as chips, a scale as numbered
// segments. Where an entry is logged (LogSheet) and where it is put right afterwards (Verlauf). A second tap on a chosen
// answer takes it back.
import { DETAILS, type Detail, type DetailSpec, type EntryDetails, type EntryType, KIND_DETAILS, withDetail } from "@gassi/domain";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Segments } from "../ui/Segments";

type Props = { type: EntryType; details: EntryDetails; change: (d: EntryDetails) => void; suggestions?: Partial<Record<Detail, readonly string[]>> };

export function DetailFields({ type, details, change, suggestions = {} }: Props) {
  return (
    <>
      {(KIND_DETAILS[type] ?? []).map((key) => (
        <DetailField key={key} name={key} spec={DETAILS[key]} value={details[key]} set={(v) => change(withDetail(details, key, v as never) ?? {})} suggestions={suggestions[key] ?? []} />
      ))}
    </>
  );
}

function DetailField({ name, spec, value, set, suggestions }: { name: Detail; spec: DetailSpec; value: unknown; set: (v: unknown) => void; suggestions: readonly string[] }) {
  const theme = useTheme();
  const accent = name === "consistency" ? theme.poop : theme.encounter;
  const toggle = (v: unknown) => set(value === v ? null : v);
  switch (spec.input) {
    case "text":
      return (
        <>
          <View style={styles.row}>
            <Field label={spec.label} value={(value as string | undefined) ?? ""} placeholder={spec.placeholder} maxLength={spec.max} onChangeText={(t) => set(t.trim() ? t : null)} />
          </View>
          {suggestions.length ? (
            <View style={styles.chips}>
              {suggestions.slice(0, 6).map((s) => (
                <Chip key={s} label={s} accent={accent} on={value === s} onPress={() => toggle(s)} />
              ))}
            </View>
          ) : null}
        </>
      );
    case "scale": {
      const steps = Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i);
      const options = steps.map((n, i) => ({ value: String(n), label: String(n), sub: spec.subs?.[i] }));
      return (
        <Labelled label={spec.label}>
          <Segments a11y={spec.label} options={options} value={value === undefined ? null : String(value)} onChange={(v) => toggle(Number(v))} kind="encounter" />
        </Labelled>
      );
    }
    case "choice":
      return (
        <Labelled label={spec.label}>
          {spec.look === "segments" ? (
            <Segments a11y={spec.label} options={spec.options} value={(value as string | undefined) ?? null} onChange={toggle} />
          ) : (
            <View style={styles.chips}>
              {spec.options.map((o) => (
                <Chip key={o.value} label={o.label} accent={accent} on={value === o.value} onPress={() => toggle(o.value)} />
              ))}
            </View>
          )}
        </Labelled>
      );
    case "choices": {
      const on = (value as string[] | undefined) ?? [];
      const flip = (v: string) => {
        const next = on.includes(v) ? on.filter((x) => x !== v) : [...on, v];
        set(next.length ? next : null);
      };
      return (
        <Labelled label={spec.label}>
          <View style={styles.chips}>
            {spec.options.map((o) => (
              <Chip key={o.value} label={o.label} accent={accent} on={on.includes(o.value)} onPress={() => flip(o.value)} />
            ))}
          </View>
        </Labelled>
      );
    }
  }
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.labelled}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  labelled: { gap: 4 },
  label: { fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  row: { flexDirection: "row" },
});
