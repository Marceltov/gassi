// Gewicht: the chosen dog's latest weight and how it changed on top, then one month at a time (‹ ›, never past this
// month): the curve of its weights and a calendar with each day's weight. A tap on a past day or today opens a sheet to
// add that day's weight, or to change or delete it. At the bottom today's weight with Eintragen beside it. With several dogs,
// chips choose the dog.
import type { Output } from "@gassi/api-client";
import { addMonths, dayHeading, dayOf, formatKg, kgToGrams, monthLabel, monthOf, noonOf, WEIGHT_MESSAGES, weightChange, weightsByDay } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { TIME_ZONE } from "../time";
import { BigButton, sizes } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { Curve } from "./Curve";
import { MonthCalendar } from "./MonthCalendar";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Weight = Output<"weights">["weights"][number];
/** The day opened from the calendar: its weight if it has one, and the kg as typed. */
type Day = { date: string; weight: Weight | undefined; kg: string };

// "7,0" under a day's number
const shortKg = (g: number | null) => formatKg(g ?? 0).replace(" kg", "");

export function Weight() {
  const theme = useTheme();
  const { dogs } = useGassi();
  const now = useNow(60_000);
  const active = dogs.filter((d) => !d.archived);
  const [chosen, setChosen] = useState<number | null>(null);
  const dogId = chosen ?? active[0]?.id ?? null;
  const thisMonth = monthOf(now, TIME_ZONE);
  const [month, setMonth] = useState(thisMonth);
  const [kg, setKg] = useState("");
  const [day, setDay] = useState<Day | null>(null);
  const { data, error, reload } = useServer((a) => a.weights());
  const { message, setMessage, run } = useWrite();

  const mine = (data?.weights ?? []).filter((w) => dogId === null || w.dogIds.includes(dogId));
  const byDay = weightsByDay(mine, TIME_ZONE);
  const inMonth = mine.filter((w) => monthOf(Date.parse(w.at), TIME_ZONE) === month);
  const points = inMonth.map((w) => ({ at: Date.parse(w.at), kg: (w.amountG ?? 0) / 1000 }));
  const change = weightChange(mine, TIME_ZONE);
  const dogIds = dogId !== null ? { dogIds: [dogId] } : {};

  const saveToday = () =>
    void run(async (api) => {
      await api.logWeight({ kg, ...dogIds });
      setKg("");
      reload();
    }, "Eingetragen.");
  const openDay = (date: string) => {
    const weight = byDay.get(date);
    setMessage(null);
    setDay({ date, weight, kg: weight ? shortKg(weight.amountG) : "" });
  };
  const saveDay = (d: Day) => {
    const amountG = kgToGrams(d.kg);
    if (amountG === null) return setMessage(WEIGHT_MESSAGES.kg);
    const w = d.weight;
    void run(async (api) => {
      if (!w) await api.logWeight({ kg: d.kg, at: noonOf(d.date, TIME_ZONE), ...dogIds });
      else await api.editEntry({ id: w.id, at: w.at, endedAt: null, dogIds: w.dogIds, amountG, foodKind: null, unitG: null, note: w.note });
      setDay(null);
      reload();
    });
  };
  const deleteDay = (d: Day) =>
    void run(async (api) => {
      if (d.weight) await api.deleteEntry({ id: d.weight.id });
      setDay(null);
      reload();
    });
  const today = dayOf(now, TIME_ZONE);
  const dayTitle = (date: string) => dayHeading(Date.parse(noonOf(date, TIME_ZONE)), TIME_ZONE);

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Gewicht</Text>
          {active.length > 1 ? (
            <View style={styles.chips}>
              {active.map((d) => (
                <Chip key={d.id} label={d.name} color={d.color} on={d.id === dogId} onPress={() => setChosen(d.id)} />
              ))}
            </View>
          ) : null}
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          {mine.length ? (
            <Text testID="weight-now" style={[styles.now, { color: theme.ink }]}>
              {formatKg(mine[0].amountG ?? 0)}
              {change ? <Text style={[styles.small, { color: theme.muted }]}>{`  ${change}`}</Text> : null}
            </Text>
          ) : data ? (
            <Text style={[styles.small, { color: theme.muted }]}>Noch kein Gewicht eingetragen.</Text>
          ) : null}
          <View style={styles.nav}>
            <View style={styles.arrow}>
              <BigButton kind="neutral" size="m" label="‹" a11y="Monat davor" onPress={() => setMonth(addMonths(month, -1))} />
            </View>
            <Text testID="weight-month" style={[styles.heading, { color: theme.ink }]}>
              {monthLabel(month)}
            </Text>
            <View style={styles.arrow}>
              <BigButton kind="neutral" size="m" label="›" a11y="Monat danach" disabled={month >= thisMonth} onPress={() => setMonth(addMonths(month, 1))} />
            </View>
          </View>
          {points.length ? <Curve points={points} height={110} /> : <Text style={[styles.small, { color: theme.muted }]}>Kein Gewicht in diesem Monat.</Text>}
          <MonthCalendar month={month} today={today} tone={theme.weight} label={dayTitle} valueOf={(date) => (byDay.has(date) ? shortKg(byDay.get(date)!.amountG) : null)} onPress={openDay} />
          <Sheet open={day !== null} onClose={() => setDay(null)} label={day ? dayTitle(day.date) : undefined}>
            {day ? (
              <View testID="weight-day-sheet" style={styles.sheet}>
                <Text style={[styles.sheetTitle, { color: theme.ink }]}>{dayTitle(day.date)}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {[active.length > 1 ? active.find((d) => d.id === dogId)?.name : null, day.weight ? `eingetragen von ${day.weight.byName}` : "noch kein Gewicht an diesem Tag"].filter(Boolean).join(" · ")}
                </Text>
                <Field label="Gewicht in kg" value={day.kg} onChangeText={(v) => setDay({ ...day, kg: v })} placeholder="z. B. 12,4" inputMode="decimal" keyboardType="decimal-pad" autoFocus={!day.weight} onSubmitEditing={() => day.kg.trim() && saveDay(day)} />
                {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
                <BigButton kind="walk" size="l" icon="check" label={day.weight ? "Speichern" : "Eintragen"} disabled={!day.kg.trim()} onPress={() => saveDay(day)} />
                {day.weight ? <BigButton kind="neutral" size="m" label="Löschen" onPress={() => deleteDay(day)} /> : null}
                <BigButton kind="neutral" size="m" label="Abbrechen" onPress={() => setDay(null)} />
              </View>
            ) : null}
          </Sheet>
        </>
      }
      bottom={
        <>
          {message && !day ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
          <View style={styles.today}>
            <Field label="Gewicht heute in kg" height={sizes.m.height} value={kg} onChangeText={setKg} placeholder="z. B. 12,4" inputMode="decimal" keyboardType="decimal-pad" onSubmitEditing={() => kg.trim() && saveToday()} />
            <View style={styles.enter}>
              <BigButton kind="walk" size="m" icon="check" label="Eintragen" disabled={!kg.trim()} onPress={saveToday} />
            </View>
          </View>
        </>
      }
      topMin={170}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13, fontWeight: "400" },
  now: { fontSize: 30, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  message: { fontSize: 15, fontWeight: "600" },
  nav: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrow: { width: 64 },
  heading: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  sheet: { gap: 10 },
  today: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  enter: { width: 150 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
});
