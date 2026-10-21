// Verlauf: who went when, fed how much, trained what and how well. The entries newest first under their day on top;
// the filters (who, what, which dog) at the bottom for the thumb. A walk opens its summary, anything else its detail.
import { byDay, ENTRY_TYPES, type EntryType, TYPE_LABEL } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { radius, useTheme } from "../theme";
import { TIME_ZONE } from "../time";
import { BigButton } from "../ui/BigButton";
import { TYPE_ICON } from "../ui/icons";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useLeaving } from "../ui/useLeaving";
import { EntryRow } from "./EntryRow";
import type { Entry, Filter } from "./form";
import { useHistory } from "./useHistory";

type Choosing = "by" | "type" | "dog";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
type Option = { label: string; on: boolean; pick: () => void };

export function History() {
  const router = useRouter();
  const theme = useTheme();
  const { people, dogs } = useGassi();
  const [filter, setFilter] = useState<Filter>({});
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const { entries, more, loadingMore, error, loadMore } = useHistory(filter);
  const now = useNow(60_000); // "Heute" becomes "Gestern" at midnight

  // a second tap before the next screen is up must not open it twice
  const { leave } = useLeaving();
  const open = (e: Entry) => leave(() => router.push(e.type === "walk" ? `/runde/${e.id}` : `/eintrag/${e.id}`));

  const active = dogs.filter((d) => !d.archived);
  const dogName = (id: number) => dogs.find((d) => d.id === id)?.name ?? "Hund";
  // which dogs, where it says something: not for one dog in the household, nor for all of them
  const dogsOf = (e: Entry) => (active.length > 1 && e.dogIds.length && !active.every((d) => e.dogIds.includes(d.id)) ? e.dogIds.map(dogName).join(", ") : "");

  const set = (change: Filter) => {
    setFilter((f) => ({ ...f, ...change }));
    setChoosing(null);
  };
  const options: Record<Choosing, Option[]> = {
    by: [{ label: "Alle", on: !filter.by, pick: () => set({ by: undefined }) }, ...people.map((p) => ({ label: p.name, on: filter.by === p.id, pick: () => set({ by: p.id }) }))],
    type: [
      { label: "Alles", on: !filter.type, pick: () => set({ type: undefined }) },
      ...ENTRY_TYPES.map((t: EntryType) => ({ label: `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`, on: filter.type === t, pick: () => set({ type: t }) })),
    ],
    dog: [{ label: "Alle", on: !filter.dog, pick: () => set({ dog: undefined }) }, ...active.map((d) => ({ label: d.name, on: filter.dog === d.id, pick: () => set({ dog: d.id }) }))],
  };
  const titles: Record<Choosing, string> = { by: "Wer?", type: "Was?", dog: "Welcher Hund?" };
  const chosen = {
    by: people.find((p) => p.id === filter.by)?.name ?? "Alle",
    type: filter.type ? TYPE_LABEL[filter.type] : "Alles",
    dog: filter.dog ? dogName(filter.dog) : "Alle",
  };
  const filtered = !!(filter.by || filter.type || filter.dog);

  const days = entries ? byDay(entries, TIME_ZONE, now) : [];
  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Verlauf</Text>
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
          <Sheet open={choosing !== null} onClose={() => setChoosing(null)}>
            {choosing ? (
              <View testID="filter-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{titles[choosing]}</Text>
                <View style={styles.options}>
                  {options[choosing].map((o) => (
                    <Pressable
                      key={o.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: o.on }}
                      onPress={o.pick}
                      style={({ pressed }) => [styles.option, { backgroundColor: o.on ? theme.walk : theme.surface, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[styles.optionText, { color: o.on ? "#fff" : theme.ink }]}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
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
  heading: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 },
  credit: { fontSize: 12, textAlign: "center", textDecorationLine: "underline" },
  filters: { flexDirection: "row", gap: 8 },
  filter: { flex: 1, minHeight: 48, borderRadius: radius.tile, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  filterText: { fontSize: 14, fontWeight: "600" },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexGrow: 1, flexBasis: "40%", minHeight: 52, borderRadius: radius.tile, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  optionText: { fontSize: 15, fontWeight: "700" },
});
