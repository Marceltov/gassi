// The details of an encounter, where it is logged (LogSheet) and where it is put right afterwards (Verlauf): a dog
// encounter's reaction 0–4, attention, how we got past and distance (#37); a person encounter's who, where, how it went
// 1–10, mood (several), insecurity 1–10 and what he said: knurrt, fiept, jault (#90). Only the reaction, and who and how it went, are needed. A
// second tap on a chosen answer takes it back.
import { ATTENTION_LABEL, ATTENTIONS, DISTANCE_LABEL, DISTANCES, type EntryDetails, HANDLING_LABEL, HANDLINGS, MOOD_LABEL, MOODS, PLACE_LABEL, PLACES, REACTION_LABEL, SCALE_MAX, SCALE_MIN, SOUND_LABEL, SOUNDS, withDetail } from "@gassi/domain";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Segments } from "../ui/Segments";

type Props = { details: EntryDetails; change: (d: EntryDetails) => void };
type Key = keyof EntryDetails;

const SCALE = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => String(SCALE_MIN + i));
const REACTIONS = REACTION_LABEL.map((sub, i) => ({ value: String(i), label: String(i), sub }));
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((value) => ({ value, label: labels[value] }));

/** Sets `key`, or takes it back when it is already `value`. */
function toggler({ details, change }: Props) {
  return <K extends Key>(key: K, value: NonNullable<EntryDetails[K]>) => change(withDetail(details, key, details[key] === value ? null : value) ?? {});
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

export function DogEncounterFields(props: Props) {
  const theme = useTheme();
  const { details: d } = props;
  const toggle = toggler(props);
  return (
    <>
      <Labelled label="Wie stark hat er reagiert?">
        <Segments a11y="Reaktion" options={REACTIONS} value={d.reaction === undefined ? null : String(d.reaction)} onChange={(v) => toggle("reaction", Number(v))} kind="encounter" />
      </Labelled>
      <Labelled label="Ansprechbar">
        <Segments a11y="Ansprechbar" options={options(ATTENTIONS, ATTENTION_LABEL)} value={d.attention ?? null} onChange={(v) => toggle("attention", v)} />
      </Labelled>
      <Labelled label="Wie seid ihr vorbei?">
        <View style={styles.chips}>
          {HANDLINGS.map((h) => (
            <Chip key={h} label={HANDLING_LABEL[h]} accent={theme.encounter} on={d.handling === h} onPress={() => toggle("handling", h)} />
          ))}
        </View>
      </Labelled>
      <Labelled label="Abstand">
        <Segments a11y="Abstand" options={options(DISTANCES, DISTANCE_LABEL)} value={d.distance ?? null} onChange={(v) => toggle("distance", v)} />
      </Labelled>
    </>
  );
}

/** `names`: who earlier encounters were with, offered as chips. */
export function PersonEncounterFields(props: Props & { names: readonly string[] }) {
  const theme = useTheme();
  const { details: d, change, names } = props;
  const toggle = toggler(props);
  const moods = d.moods ?? [];
  const sounds = d.sounds ?? [];
  return (
    <>
      <View style={styles.row}>
        <Field label="Wer?" value={d.who ?? ""} placeholder="z. B. Oma Inge" maxLength={60} onChangeText={(who) => change(withDetail(d, "who", who.trim() ? who : null) ?? {})} />
      </View>
      {names.length ? (
        <View style={styles.chips}>
          {names.slice(0, 6).map((n) => (
            <Chip key={n} label={n} accent={theme.encounter} on={d.who === n} onPress={() => toggle("who", n)} />
          ))}
        </View>
      ) : null}
      <Segments a11y="Wo" options={options(PLACES, PLACE_LABEL)} value={d.place ?? null} onChange={(v) => toggle("place", v)} />
      <Labelled label="Wie lief's? (1 schlecht – 10 super)">
        <Segments a11y="Wie lief es" options={SCALE.map((v) => ({ value: v, label: v }))} value={d.rating === undefined ? null : String(d.rating)} onChange={(v) => toggle("rating", Number(v))} kind="encounter" />
      </Labelled>
      <Labelled label="Stimmung">
        <View style={styles.chips}>
          {MOODS.map((m) => (
            <Chip key={m} label={MOOD_LABEL[m]} accent={theme.encounter} on={moods.includes(m)} onPress={() => change(withDetail(d, "moods", moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m]) ?? {})} />
          ))}
        </View>
      </Labelled>
      <Labelled label="Wie unsicher? (1 gar nicht – 10 sehr)">
        <Segments a11y="Wie unsicher" options={SCALE.map((v) => ({ value: v, label: v }))} value={d.insecurity === undefined ? null : String(d.insecurity)} onChange={(v) => toggle("insecurity", Number(v))} kind="encounter" />
      </Labelled>
      <View style={styles.chips}>
        {SOUNDS.map((s) => (
          <Chip key={s} label={SOUND_LABEL[s]} accent={theme.encounter} on={sounds.includes(s)} onPress={() => change(withDetail(d, "sounds", sounds.includes(s) ? sounds.filter((x) => x !== s) : [...sounds, s]) ?? {})} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  labelled: { gap: 4 },
  label: { fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  row: { flexDirection: "row" },
});
