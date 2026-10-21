// A walk looked back on: after Zuhause, and from Verlauf. The map when there is a track, Dauer, Strecke, Pause, who
// went (tap a person to change it), each Pipi/Poopoo with its time, the trainings, a note, and a way to its detail
// (time, end, dogs, delete); Fertig leads back. Right after Zuhause without reception it shows what this phone knows
// and says so; changes need the server (the writes' client: OFFLINE without reception, NO_ANSWER without an answer
// in time).
import { formatDistance, formatMinutes, keepsOne, simplify } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { errorMessage, OFFLINE } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { TrackMap } from "../map/TrackMap";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Screen } from "../ui/Screen";
import { LAST_WALKER } from "./lastOne";
import { trainingLine } from "./lines";
import type { Shown, Tap } from "./taps";
import { useWalkSummary } from "./useWalkSummary";

export function Summary({ idOrKey }: { idOrKey: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { writeApi, people, dogs } = useGassi();
  const { shown, track, local, error, reload } = useWalkSummary(idOrKey);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null); // null: as the server has it
  const routes = useMemo(() => (track ? [simplify(track.points, 500)] : []), [track]);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/"));
  // an edit sends all of the walk's fields (left-out ones would become empty), with the change; whether it went through
  const edit = async (s: Shown, change: { walkers?: string[]; note?: string | null }): Promise<boolean> => {
    if (s.id === null || !writeApi) {
      setMessage(OFFLINE);
      return false;
    }
    try {
      await writeApi.editEntry({ id: s.id, at: s.startedAt, endedAt: s.endedAt, note: s.note, ...change });
      setMessage(null);
      reload();
      return true;
    } catch (e) {
      setMessage(errorMessage(e));
      return false;
    }
  };
  // the typed note stays until it is saved
  const saveNote = async (s: Shown, text: string) => {
    if (await edit(s, { note: text.trim() || null })) setNote(null);
  };

  if (!shown) {
    const waitText = <Text style={[styles.line, { color: theme.muted }]}>{error ?? "Lädt …"}</Text>;
    return <Screen top={waitText} bottom={<BigButton kind="neutral" size="l" label="Fertig" onPress={done} />} />;
  }

  const several = new Set(shown.taps.map((t) => t.dogId)).size > 1 || dogs.filter((d) => !d.archived).length > 1;
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  const markText = (t: Tap) => `${hhmm(t.at)}${several ? ` · ${dogName(t.dogId)}` : ""}`;
  const everyone = [...people, ...shown.walkers.filter((w) => !people.some((p) => p.id === w.id))];
  const walkerIds = shown.walkers.map((w) => w.id);
  const toggle = (id: string) => {
    if (!walkerIds.includes(id)) return edit(shown, { walkers: [...walkerIds, id] });
    if (keepsOne(walkerIds, id)) return edit(shown, { walkers: walkerIds.filter((w) => w !== id) });
    setMessage(LAST_WALKER);
  };
  const noteText = note ?? shown.note ?? "";

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>{`Runde ${hhmm(shown.startedAt)}${shown.endedAt ? `–${hhmm(shown.endedAt)}` : ""}`}</Text>
          {local ? <Text style={[styles.small, { color: theme.muted }]}>Noch nicht gesendet – kommt an, sobald Empfang da ist.</Text> : null}
          {routes.length ? <TrackMap routes={routes} height={220} /> : null}
          <View style={styles.stats}>
            {stat("Dauer", formatMinutes(shown.totalMin))}
            {stat("Strecke", track ? formatDistance(track.metrics.distanceM) : "–")}
            {stat("Pause", formatMinutes(shown.pauseMin))}
          </View>
          <Text style={[styles.small, { color: theme.muted }]}>Wer war dabei</Text>
          <View style={styles.chips}>
            {everyone.map((p) => (
              <Chip key={p.id} label={p.name} on={walkerIds.includes(p.id)} onPress={() => void toggle(p.id)} />
            ))}
          </View>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {marks("💧 Pipi", shown.taps.filter((t) => t.type === "pee"), "summary-pees")}
            {marks("💩 Poopoo", shown.taps.filter((t) => t.type === "poop"), "summary-poops")}
            {shown.trainings.map((t, i) => (
              <Text key={i} style={[styles.line, { color: theme.ink }]}>
                {trainingLine(t)}
              </Text>
            ))}
          </View>
          <TextInput
            value={noteText}
            onChangeText={setNote}
            placeholder="Notiz"
            placeholderTextColor={theme.muted}
            multiline
            style={[styles.note, { color: theme.ink, backgroundColor: theme.surface }]}
          />
          {note !== null && note !== (shown.note ?? "") ? <BigButton kind="neutral" size="m" label="Notiz speichern" onPress={() => void saveNote(shown, note)} /> : null}
          {message ? <Text style={[styles.small, { color: theme.muted }]}>{message}</Text> : null}
          {shown.id !== null && !local ? <BigButton kind="neutral" size="m" label="Zeit, Hunde, Löschen …" onPress={() => router.push(`/eintrag/${shown.id}`)} /> : null}
        </>
      }
      bottom={<BigButton kind="walk" size="l" label="Fertig" onPress={done} />}
    />
  );

  function stat(label: string, value: string) {
    return (
      <View style={[styles.stat, { backgroundColor: theme.surface }]}>
        <Text style={[styles.small, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
      </View>
    );
  }
  // how many, then each with its time (and dog): one the server has opens its detail (time, dog, delete)
  function marks(label: string, taps: Tap[], testID: string) {
    return (
      <View testID={testID} style={styles.marks}>
        <View style={styles.row}>
          <Text style={[styles.line, { color: theme.ink }]}>{label}</Text>
          <Text style={[styles.line, styles.right, { color: theme.ink }]}>{taps.length ? `${taps.length}×` : "keins"}</Text>
        </View>
        {taps.map((t) =>
          t.id !== undefined && !local ? (
            <Pressable
              key={`${t.id}`}
              testID={`summary-mark-${t.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${label.slice(label.indexOf(" ") + 1)} ${markText(t)} ändern`}
              onPress={() => router.push(`/eintrag/${t.id}`)}
              style={({ pressed }) => [styles.mark, { backgroundColor: theme.neutral, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.line, { color: theme.ink }]}>{markText(t)}</Text>
              <Text style={[styles.line, { color: theme.muted }]}>›</Text>
            </Pressable>
          ) : (
            <View key={`${t.at}/${t.dogId}`} style={styles.mark}>
              <Text style={[styles.line, { color: theme.muted }]}>{`${markText(t)} · wartet auf Empfang`}</Text>
            </View>
          ),
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  value: { fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderRadius: 12, padding: 12, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  marks: { gap: 4 },
  mark: { flexDirection: "row", justifyContent: "space-between", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40, alignItems: "center" },
  line: { fontSize: 15 },
  right: { flexShrink: 1, textAlign: "right" },
  note: { borderRadius: 12, padding: 12, minHeight: 60, fontSize: 15 },
});
