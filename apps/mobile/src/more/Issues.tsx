// Wünsche und Fehler (#45): the repo's GitHub issues as the server reads them, open first, then the recently closed;
// a row is the title and one line (number, date, Wunsch or Fehler, "aus der App"), and a tap opens it on GitHub. What
// was read last is kept on this phone, so without reception the list is still there, with a note. At the bottom a
// filter over titles and numbers, and "Wunsch oder Fehler melden" (#39), which opens the form.
import type { Output } from "@gassi/api-client";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { loadKept, saveKept } from "../data/kept";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { shortDay } from "../time";
import { BigButton } from "../ui/BigButton";
import { Field } from "../ui/Field";
import { Group } from "../ui/List";
import { Screen } from "../ui/Screen";
import { KIND_LABEL, ReportSheet } from "./ReportSheet";
import { useServer } from "./useServer";

type Issue = Output<"issues">["issues"][number];

const KEY = "issues";
// GitHub's own colors for open and closed
const OPEN = "#3fb950";
const CLOSED = "#a371f7";

const kept = (): Issue[] | null => {
  const k = loadKept(KEY);
  return Array.isArray(k) ? (k as Issue[]) : null;
};

export function Issues() {
  const theme = useTheme();
  const now = useNow(60_000);
  const { online } = useGassi();
  const { data, error, reload } = useServer(async (api) => {
    const { issues } = await api.issues();
    saveKept(KEY, issues);
    return issues;
  });
  const issues = data ?? kept();
  const [filter, setFilter] = useState("");
  const [reporting, setReporting] = useState(false);

  const words = filter.trim().toLowerCase().replace(/^#/, "");
  const shown = (issues ?? []).filter((i) => !words || i.title.toLowerCase().includes(words) || String(i.number) === words);
  const open = shown.filter((i) => i.open);
  const closed = shown.filter((i) => !i.open);
  const stale = issues && (!online || error);

  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Wünsche und Fehler</Text>}
      top={
        <>
          {open.length ? <IssueGroup title="Offen" issues={open} now={now} /> : null}
          {closed.length ? <IssueGroup title="Erledigt" issues={closed} now={now} /> : null}
          {issues && !shown.length ? <Text style={[styles.small, { color: theme.muted }]}>{words ? "Nichts gefunden." : "Noch nichts gemeldet."}</Text> : null}
          {!issues && error ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
        </>
      }
      bottom={
        <>
          <View style={styles.search}>
            <Field label="Suchen" value={filter} onChangeText={setFilter} placeholder="Titel oder Nummer" />
          </View>
          <Text testID="issues-note" style={[styles.note, { color: theme.muted }]}>
            {stale ? "Ohne Verbindung: der Stand von zuletzt" : "Aus GitHub · Tippen öffnet dort"}
          </Text>
          <BigButton kind="ink" size="m" icon="feedback" label="Wunsch oder Fehler melden" onPress={() => setReporting(true)} />
          <ReportSheet
            open={reporting}
            onClose={() => setReporting(false)}
            onDone={() => {
              setReporting(false);
              setFilter("");
              reload();
            }}
          />
        </>
      }
    />
  );
}

function IssueGroup({ title, issues, now }: { title: string; issues: Issue[]; now: number }) {
  return (
    <Group title={title}>
      {issues.map((i) => (
        <IssueRow key={i.number} issue={i} now={now} />
      ))}
    </Group>
  );
}

function IssueRow({ issue: i, now }: { issue: Issue; now: number }) {
  const theme = useTheme();
  const when = i.open ? shortDay(i.at, now) : `erledigt ${shortDay(i.at, now)}`;
  return (
    <Pressable
      testID={`issue-${i.number}`}
      accessibilityRole="link"
      accessibilityLabel={`${i.title}, Nummer ${i.number}, ${i.open ? "offen" : "erledigt"}`}
      onPress={() => void Linking.openURL(i.url)}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.rowTitle, { color: i.open ? theme.ink : theme.muted }]} numberOfLines={1}>
        {i.title}
      </Text>
      <View style={styles.line}>
        <View style={[styles.dot, { backgroundColor: i.open ? OPEN : CLOSED }]} />
        <Text style={[styles.sub, { color: theme.muted }]} numberOfLines={1}>{`#${i.number} · ${when}`}</Text>
        {i.kind ? <Label text={KIND_LABEL[i.kind]} /> : null}
        {i.fromApp ? <Label text="aus der App" /> : null}
      </View>
    </Pressable>
  );
}

function Label({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.muted, backgroundColor: theme.neutral }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  search: { flexDirection: "row" },
  note: { fontSize: 12, textAlign: "center" },
  row: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  rowTitle: { fontSize: 15 },
  line: { flexDirection: "row", alignItems: "center", gap: 6, overflow: "hidden" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { fontSize: 12, flexShrink: 1 },
  label: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: "hidden" },
});
