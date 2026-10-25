// One numbered step of a hint (Akku, #108): its title, how far it is (green when done, amber when not), what to do.
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";

export function Step({ n, title, sub, state, done, children }: { n: number; title: string; sub?: string; state?: string | null; done?: boolean; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.head}>
        <View style={[styles.num, { backgroundColor: theme.neutral }]}>
          <Text style={[styles.n, { color: theme.ink }]}>{n}</Text>
        </View>
        <View style={styles.titles}>
          <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
          {sub ? <Text style={[styles.sub, { color: theme.muted }]}>{sub}</Text> : null}
          {state ? <Text style={[styles.sub, { color: done ? theme.walk : theme.warn }]}>{state}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.tile, padding: 14, gap: 10 },
  head: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  n: { fontSize: 13, fontWeight: "700" },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  sub: { fontSize: 14 },
});
