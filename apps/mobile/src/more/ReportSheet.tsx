// "Wunsch oder Fehler melden" (#39): Wunsch or Fehler, a short title and a text (the keyboard's microphone dictates
// it), sent to the server, which files it on GitHub as who sent it from which device; the app version goes with it.
// Needs the server: without reception it says so (useWrite).
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Field } from "../ui/Field";
import { Segments } from "../ui/Segments";
import { Sheet } from "../ui/Sheet";
import { APP_VERSION } from "../version";
import { useWrite } from "./useWrite";

export const KIND_LABEL = { wish: "Wunsch", bug: "Fehler" } as const;
type Kind = keyof typeof KIND_LABEL;
const KINDS = (Object.keys(KIND_LABEL) as Kind[]).map((value) => ({ value, label: KIND_LABEL[value] }));

/** `onDone`: after it was filed (the list reloads and shows it). */
export function ReportSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Melden">
      {open ? <ReportForm onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function ReportForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const { message, run } = useWrite();
  const [kind, setKind] = useState<Kind>("wish");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const send = () => void run((api) => api.reportIssue({ kind, title, text, version: APP_VERSION })).then((ok) => ok && onDone());

  return (
    <View testID="report-sheet" style={styles.form}>
      <Text style={[styles.title, { color: theme.ink }]}>Melden</Text>
      <Segments options={KINDS} value={kind} onChange={setKind} />
      {/* a Field takes the width of the row it is in */}
      <View style={styles.row}>
        <Field label="Worum geht es?" value={title} onChangeText={setTitle} maxLength={120} placeholder="Kurz, in ein paar Worten" />
      </View>
      <View style={styles.row}>
        <Field label={kind === "wish" ? "Was soll anders sein?" : "Was ist passiert?"} value={text} onChangeText={setText} maxLength={5000} multiline />
      </View>
      <Text style={[styles.small, { color: theme.muted }]}>Geht mit deinem Namen, dem Gerät und der App-Version an GitHub.</Text>
      {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
      <ButtonRow side={[<BigButton key="no" kind="side" size="m" label="Abbrechen" onPress={onClose} />]} main={<BigButton kind="ink" size="m" icon="check" label="Senden" disabled={!title.trim()} onPress={send} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  row: { flexDirection: "row" },
  title: { fontSize: 18, fontWeight: "700" },
  small: { fontSize: 12 },
  message: { fontSize: 15, fontWeight: "600" },
});
