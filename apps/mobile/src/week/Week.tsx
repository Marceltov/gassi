// Woche: the week's totals per person, a 0–24 h strip per day (walks, feedings, trainings) and all its routes on one
// map. The week and the arrows to the week before and after stay on top as its title (#71); the map takes the height
// that is left. A swipe sideways or ← → on a keyboard goes to the week before and after too. A walk counts fully for
// each walker.
import { addDays, countsLine, formatMinutes, mondayOf, type PersonWeek, weekLabel } from "@gassi/domain";
import { useCallback, useState } from "react";
import { useNow } from "../start/useNow";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrackMap } from "../map/TrackMap";
import { FIELD_HEIGHT, space, useTheme } from "../theme";
import { TIME_ZONE } from "../time";
import { Graded } from "../ui/Graded";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { useArrowKeys } from "../ui/useArrowKeys";
import { useSwipe } from "../ui/useSwipe";
import { Strip, StripHours } from "./Strip";
import { useWeek } from "./useWeek";

const km = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export function Week() {
  const theme = useTheme();
  const now = useNow(60_000);
  const [monday, setMonday] = useState(() => mondayOf(Date.now(), TIME_ZONE));
  const { week, stale, error } = useWeek(monday);
  const thisWeek = monday >= mondayOf(now, TIME_ZONE);
  const before = useCallback(() => setMonday((m) => addDays(m, -7)), []);
  const after = useCallback(() => {
    if (!thisWeek) setMonday((m) => addDays(m, 7));
  }, [thisWeek]);
  const swipe = useSwipe(after, before);
  useArrowKeys(before, after);

  // the training's cell has its counts colored (#100)
  const cell = (testID: string, text: string, flex: number, { bold = false, graded = false } = {}) => (
    <Graded testID={testID} style={[styles.cell, { flex, color: bold ? theme.ink : theme.muted, fontWeight: bold ? "700" : "400" }]} text={text} plain={!graded} />
  );
  const row = (p: PersonWeek) => (
    <View key={p.id} style={styles.line}>
      {cell(`week-${p.name}-name`, p.name, 1.2, { bold: true })}
      {cell(`week-${p.name}-walks`, `${p.walks} · ${formatMinutes(p.walkMin)}`, 1.6)}
      {cell(`week-${p.name}-km`, km(p.km), 0.8)}
      {cell(`week-${p.name}-food`, String(p.feedings), 0.8)}
      {cell(`week-${p.name}-training`, `${p.trainings} · ${countsLine(p)}`, 1.4, { graded: true })}
    </View>
  );

  const top = (
    <>
      {error ? <Text style={[styles.note, { color: theme.muted }]}>{error}</Text> : null}
      {stale ? <Text style={[styles.note, { color: theme.muted }]}>Keine Verbindung – das ist der letzte Stand.</Text> : null}
      {week ? (
        <>
          <View style={styles.line}>
            {["", "Runden · Zeit", "km", "Futter", "Training"].map((h, i) => (
              <Text key={h || "name"} style={[styles.cell, styles.head, { flex: [1.2, 1.6, 0.8, 0.8, 1.4][i], color: theme.muted }]}>
                {h}
              </Text>
            ))}
          </View>
          {week.byPerson.length ? week.byPerson.map(row) : <Text style={[styles.note, { color: theme.muted }]}>Diese Woche ist noch nichts passiert.</Text>}
          <View style={styles.strips}>
            <StripHours />
            {week.days.map((d) => (
              <Strip key={d.date} day={d} />
            ))}
            <View style={styles.legend}>
              {([["walk", "Gassi"], ["food", "Futter"], ["training", "Training"]] as const).map(([k, l]) => (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: theme[k] }]} />
                  <Text style={[styles.small, { color: theme.muted }]}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
          {week.routes.length ? <TrackMap routes={week.routes.map((r) => r.route)} height={{ min: 200 }} /> : null}
        </>
      ) : null}
    </>
  );

  const head = (
    <View style={styles.nav}>
      <Arrow icon="back" label="Vorherige Woche" onPress={before} />
      <Text testID="week-heading" style={[styles.heading, { color: theme.ink }]}>
        {weekLabel(monday)}
      </Text>
      <Arrow icon="next" label="Nächste Woche" disabled={thisWeek} onPress={after} />
    </View>
  );

  return (
    <View style={styles.screen} {...swipe}>
      <Screen head={head} top={top} />
    </View>
  );
}

/** Just the arrow, no button around it. */
function Arrow({ icon, label, disabled = false, onPress }: { icon: "back" | "next"; label: string; disabled?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.arrow, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={30} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  line: { flexDirection: "row", gap: 4, alignItems: "center" },
  cell: { fontSize: 13 },
  head: { fontSize: 11 },
  note: { fontSize: 14 },
  strips: { gap: 4, marginVertical: space.gap },
  legend: { flexDirection: "row", gap: 14, justifyContent: "flex-end" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  small: { fontSize: 12 },
  nav: { flexDirection: "row", alignItems: "center", gap: space.gap },
  arrow: { width: FIELD_HEIGHT, height: FIELD_HEIGHT, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, textAlign: "center", fontSize: 22, fontWeight: "700" },
});
