// Verlauf: who went when, fed how much, trained what and how well. The title stays on top, the entries newest first
// under their day scroll below it, the filters (who, what, which dog) stay at the bottom for the thumb. A walk opens its summary, anything else its detail.
// What is shown lives in the URL (/verlauf?type=pee), so a Start tile, a link or a reload can open it filtered. A tap
// on the Verlauf tab clears every filter.
import { byDay, ENTRY_TYPES, type EntryType, oneRowPerCount, TYPE_LABEL } from "@gassi/domain";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { FIELD_HEIGHT, radius, useTheme } from "../theme";
import { TIME_ZONE } from "../time";
import { BigButton } from "../ui/BigButton";
import { type Choice, ChoiceList } from "../ui/ChoiceList";
import { TYPE_ICON } from "../ui/icons";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useLeaving } from "../ui/useLeaving";
import { EntryRow } from "./EntryRow";
import type { Entry, Filter } from "./form";
import { useHistory } from "./useHistory";

type Choosing = "by" | "type" | "dog";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";

export function History() {
  const router = useRouter();
  const theme = useTheme();
  const { people, dogs } = useGassi();
  const param = useLocalSearchParams<{ type?: string }>().type;
  const type = ENTRY_TYPES.find((t) => t === param);
  const [rest, setRest] = useState<Omit<Filter, "type">>({});
  // the tab bar's press on Verlauf (the tabs are this stack's parent): everything again
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.getParent()?.addListener("tabPress" as never, () => {
        setRest({});
        navigation.setParams({ type: undefined } as never); // its own params: the press may come from another tab
      }),
    [navigation],
  );
  const filter: Filter = { ...rest, type };
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const { entries, more, loadingMore, error, loadMore } = useHistory(filter);
  const now = useNow(60_000); // "Heute" becomes "Gestern" at midnight

  // a second tap before the next screen is up must not open it twice
  const { leave } = useLeaving();
  const open = (e: Entry) => leave(() => router.push(e.type === "walk" ? `/verlauf/runde/${e.id}` : `/verlauf/eintrag/${e.id}`));

  const active = dogs.filter((d) => !d.archived);
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  // always which dogs, so every row reads the same way (#71)
  const dogsOf = (e: Entry) => e.dogIds.map(dogName).join(", ");

  const set = (change: Filter) => {
    const { type: chosen, ...others } = change;
    if ("type" in change) router.setParams({ type: chosen });
    setRest((f) => ({ ...f, ...others }));
    setChoosing(null);
  };
  // "Alle" first, then each option; the chosen one is marked
  const options: Record<Choosing, Choice[]> = {
    by: [{ key: "", label: "Alle", on: !filter.by, onPress: () => set({ by: undefined }) }, ...people.map((p) => ({ key: p.id, label: p.name, on: filter.by === p.id, onPress: () => set({ by: p.id }) }))],
    type: [
      { key: "", label: "Alles", on: !filter.type, onPress: () => set({ type: undefined }) },
      ...ENTRY_TYPES.map((t: EntryType) => ({ key: t, label: TYPE_LABEL[t], icon: TYPE_ICON[t], on: filter.type === t, onPress: () => set({ type: t }) })),
    ],
    dog: [{ key: "", label: "Alle", on: !filter.dog, onPress: () => set({ dog: undefined }) }, ...active.map((d) => ({ key: d.id, label: d.name, color: d.color, on: filter.dog === d.id, onPress: () => set({ dog: d.id }) }))],
  };
  const titles: Record<Choosing, string> = { by: "Wer?", type: "Was?", dog: "Welcher Hund?" };
  const chosen = {
    by: people.find((p) => p.id === filter.by)?.name ?? "Alle",
    type: filter.type ? TYPE_LABEL[filter.type] : "Alles",
    dog: filter.dog ? dogName(filter.dog) : "Alle",
  };
  const filtered = !!(filter.by || filter.type || filter.dog);

  const days = entries ? byDay(oneRowPerCount(entries), TIME_ZONE, now) : [];
  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Verlauf</Text>}
      top={
        <>
          {error ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          {entries === null && !error ? <Text style={[styles.small, { color: theme.muted }]}>Lädt …</Text> : null}
          {entries?.length === 0 ? <Text style={[styles.small, { color: theme.muted }]}>{filtered ? "Nichts für diese Auswahl." : "Noch nichts eingetragen."}</Text> : null}
          {days.map((day) => (
            <View key={day.day} style={styles.day}>
              <Text style={[styles.heading, { color: theme.muted }]}>{day.heading}</Text>
              {day.entries.map((e) => (
                <EntryRow key={e.id} entry={e} dogs={dogsOf(e)} onPress={() => open(e)} />
              ))}
            </View>
          ))}
          {more ? <BigButton kind="neutral" size="m" label={loadingMore ? "Lädt …" : "Ältere zeigen"} onPress={loadMore} /> : null}
          {entries?.some((e) => e.route) ? (
            // the small maps leave out their credit line: it is here instead
            <Text accessibilityRole="link" onPress={() => void Linking.openURL(OSM_COPYRIGHT)} style={[styles.credit, { color: theme.muted }]}>
              Karten © OpenStreetMap-Mitwirkende
            </Text>
          ) : null}
        </>
      }
      bottom={
        <>
          <View style={styles.filters}>
            <FilterButton label={`Wer: ${chosen.by}`} on={!!filter.by} onPress={() => setChoosing("by")} />
            <FilterButton label={`Was: ${chosen.type}`} on={!!filter.type} onPress={() => setChoosing("type")} />
            {active.length > 1 ? <FilterButton label={`Hund: ${chosen.dog}`} on={!!filter.dog} onPress={() => setChoosing("dog")} /> : null}
          </View>
          <Sheet open={choosing !== null} onClose={() => setChoosing(null)} label={choosing ? titles[choosing] : undefined}>
            {choosing ? (
              <View testID="filter-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{titles[choosing]}</Text>
                <ChoiceList choices={options[choosing]} />
              </View>
            ) : null}
          </Sheet>
        </>
      }
    />
  );
}

function FilterButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.filter, { backgroundColor: on ? theme.neutral : theme.surface, borderColor: on ? theme.ink : theme.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.filterText, { color: on ? theme.ink : theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  day: { gap: 6 },
  heading: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  credit: { fontSize: 12, textAlign: "center", textDecorationLine: "underline" },
  filters: { flexDirection: "row", gap: 8 },
  filter: { flex: 1, height: FIELD_HEIGHT, borderRadius: radius.tile, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  filterText: { fontSize: 14, fontWeight: "600" },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
});
