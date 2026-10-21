// A walk looked back on: after Zuhause, and from Verlauf. The map when there is a track, Dauer, Strecke, Pause, who
// went (tap a person to change it), each Pipi/Poopoo with its time, the trainings, a note; Fertig leads back. Right
// after Zuhause without reception it shows what this phone knows and says so; changes need the server.
import { formatDistance, formatMinutes, keepsOne, simplify } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { errorMessage, OFFLINE } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { TrackMap } from "../map/TrackMap";
import { useTheme } from "../theme";
import { hhmm } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Screen } from "../ui/Screen";
import { trainingLine } from "./lines";
import type { Shown, Tap } from "./taps";
import { useWalkSummary } from "./useWalkSummary";

export function Summary({ idOrKey }: { idOrKey: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { api, people, dogs } = useGassi();
  const { shown, track, local, error, reload } = useWalkSummary(idOrKey);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null); // null: as the server has it
  const routes = useMemo(() => (track ? [simplify(track.points, 500)] : []), [track]);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/"));
  // an edit sends all of the walk's fields (left-out ones would become empty), with the change
  const edit = async (s: Shown, change: { walkers?: string[]; note?: string | null }) => {
    if (s.id === null || !api) return setMessage(OFFLINE);
    try {
      await api.editEntry({ id: s.id, at: s.startedAt, endedAt: s.endedAt, note: s.note, ...change });
      setMessage(null);
      reload();
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  if (!shown) {
    const waitText = <Text style={[styles.line, { color: theme.muted }]}>{error ?? "Lädt …"}</Text>;
    return <Screen top={waitText} bottom={<BigButton kind="neutral" size="l" label="Fertig" onPress={done} />} />;
  }

  const several = new Set(shown.taps.map((t) => t.dogId)).size > 1 || dogs.filter((d) => !d.archived).length > 1;
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  const marks = (taps: Tap[]) => (taps.length ? `${taps.length}× · ${taps.map((t) => `${hhmm(t.at)}${several ? ` ${dogName(t.dogId)}` : ""}`).join(", ")}` : "keins");
  const everyone = [...people, ...shown.walkers.filter((w) => !people.some((p) => p.id === w.id))];
  const walkerIds = shown.walkers.map((w) => w.id);
  const toggle = (id: string) => {
    if (!walkerIds.includes(id)) return edit(shown, { walkers: [...walkerIds, id] });
    if (keepsOne(walkerIds, id)) return edit(shown, { walkers: walkerIds.filter((w) => w !== id) });
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
            {row("💧 Pipi", marks(shown.taps.filter((t) => t.type === "pee")), "summary-pees")}
            {row("💩 Poopoo", marks(shown.taps.filter((t) => t.type === "poop")), "summary-poops")}
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
          {note !== null && note !== (shown.note ?? "") ? <BigButton kind="neutral" size="m" label="Notiz speichern" onPress={() => void edit(shown, { note: note.trim() || null }).then(() => setNote(null))} /> : null}
          {message ? <Text style={[styles.small, { color: theme.muted }]}>{message}</Text> : null}
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
  function row(label: string, value: string, testID: string) {
    return (
      <View testID={testID} style={styles.row}>
        <Text style={[styles.line, { color: theme.ink }]}>{label}</Text>
        <Text style={[styles.line, styles.right, { color: theme.ink }]}>{value}</Text>
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
  line: { fontSize: 15 },
  right: { flexShrink: 1, textAlign: "right" },
  note: { borderRadius: 12, padding: 12, minHeight: 60, fontSize: 15 },
});
