// A walk looked back on: after Zuhause, and from Verlauf. The map when there is a track, Dauer, Strecke, Pause, who
// went (tap a person to change it), how many Pipi, Markiert, Poopoo and trainings, then each of them by time (a tap opens it),
// a note, and a way to its detail
// (time, end, dogs, delete); Fertig leads back. The title and the figures stay on top, the way to the detail and Fertig
// at the bottom; the map, who went, what happened and the note scroll between them (#71). Right after Zuhause without reception it shows what this phone knows
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
import { ButtonRow } from "../ui/ButtonRow";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { useTabPath } from "../ui/tabPath";
import { LAST_WALKER } from "./lastOne";
import { TYPE_ICON, TYPE_TONE } from "../ui/icons";
import { countLine, tapLine, trainingLine, type WalkItem, walkItems } from "./lines";
import type { Shown } from "./taps";
import { useWalkSummary } from "./useWalkSummary";

export function Summary({ idOrKey }: { idOrKey: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { writeApi, people, dogs } = useGassi();
  const { shown, track, local, error, reload } = useWalkSummary(idOrKey);
  const tabPath = useTabPath();
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
    return <Screen top={waitText} bottom={<BigButton kind="walk" size="m" icon="check" label="Fertig" onPress={done} />} />;
  }

  const several = new Set(shown.taps.map((t) => t.dogId)).size > 1 || dogs.filter((d) => !d.archived).length > 1;
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  // what a row says after its time: "Pipi", "Poopoo · weich · Toffee", "Training · 4 Min. · Sitz 4/5"
  const itemText = (i: WalkItem) => (i.kind === "tap" ? tapLine(i.tap, several && i.tap.dogId !== null ? dogName(i.tap.dogId) : null) : trainingLine(i.training));
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
      head={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>{`Runde ${hhmm(shown.startedAt)}${shown.endedAt ? `–${hhmm(shown.endedAt)}` : ""}`}</Text>
          {local ? <Text style={[styles.small, { color: theme.muted }]}>Noch nicht gesendet – kommt an, sobald Empfang da ist.</Text> : null}
          <View style={styles.stats}>
            {stat("Dauer", formatMinutes(shown.totalMin))}
            {stat("Strecke", track ? formatDistance(track.metrics.distanceM) : "–")}
            {stat("Pause", formatMinutes(shown.pauseMin))}
          </View>
        </>
      }
      top={
        <>
          {routes.length ? <TrackMap routes={routes} height={220} /> : null}
          <Text style={[styles.small, { color: theme.muted }]}>Wer war dabei</Text>
          <View style={styles.chips}>
            {everyone.map((p) => (
              <Chip key={p.id} label={p.name} on={walkerIds.includes(p.id)} onPress={() => void toggle(p.id)} />
            ))}
          </View>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text testID="summary-counts" style={[styles.line, { color: theme.ink }]}>
              {countLine(shown.taps, shown.trainings)}
            </Text>
            {walkItems(shown.taps, shown.trainings).map(row)}
          </View>
          <TextInput
            value={noteText}
            onChangeText={setNote}
            placeholder="Notiz"
            placeholderTextColor={theme.muted}
            multiline
            style={[styles.note, { color: theme.ink, backgroundColor: theme.surface }]}
          />
          {note !== null && note !== (shown.note ?? "") ? <BigButton kind="side" size="m" label="Notiz speichern" onPress={() => void saveNote(shown, note)} /> : null}
        </>
      }
      bottom={
        <>
          {message ? <Text style={[styles.small, { color: theme.muted }]}>{message}</Text> : null}
          {/* the detail (time, dogs, Löschen) is a side action next to Fertig (#80) */}
          <ButtonRow
            side={[shown.id !== null && !local ? <BigButton key="detail" kind="side" size="m" label="Ändern …" a11y="Zeit, Hunde, Löschen …" onPress={() => router.push(tabPath(`/eintrag/${shown.id}`))} /> : null]}
            main={<BigButton kind="walk" size="m" icon="check" label="Fertig" onPress={done} />}
          />
        </>
      }
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
  // one pee, marking, poop or training by its time: one the server has opens its detail (time, dog, delete; a training's
  // exercises), one only this phone has waits for reception
  function row(i: WalkItem) {
    const id = i.kind === "tap" ? i.tap.id : i.training.id;
    const type = i.kind === "tap" ? i.tap.type : "training";
    const text = itemText(i);
    const content = (
      <>
        <Text style={[styles.line, styles.time, { color: theme.muted }]}>{hhmm(i.at)}</Text>
        <Icon name={TYPE_ICON[type]} size={17} color={theme[TYPE_TONE[type]]} />
        <Text style={[styles.line, styles.text, { color: id !== undefined && !local ? theme.ink : theme.muted }]}>{id !== undefined && !local ? text : `${text} · wartet auf Empfang`}</Text>
      </>
    );
    const key = `${i.kind}${i.at}${i.kind === "tap" ? i.tap.dogId : ""}`;
    if (id === undefined || local)
      return (
        <View key={key} style={styles.mark}>
          {content}
        </View>
      );
    return (
      <Pressable
        key={key}
        testID={i.kind === "tap" ? `summary-mark-${id}` : `summary-training-${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${hhmm(i.at)} ${text} ändern`}
        onPress={() => router.push(tabPath(`/eintrag/${id}`))}
        style={({ pressed }) => [styles.mark, { backgroundColor: theme.neutral, opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
        <Icon name="next" size={18} color={theme.muted} />
      </Pressable>
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
  mark: { flexDirection: "row", gap: 8, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40, alignItems: "center" },
  time: { fontVariant: ["tabular-nums"] },
  text: { flex: 1 },
  line: { fontSize: 15 },
  note: { borderRadius: 12, padding: 12, minHeight: 60, fontSize: 16 },
});
