// Gewicht: the chosen dog's curve and its weights (newest first, a tap opens one to change or delete it) on top; the
// new weight in kg and Eintragen at the bottom. With several dogs, chips choose the dog.
import { dayHeading, formatKg } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { TIME_ZONE } from "../time";
import { BigButton } from "../ui/BigButton";
import { Chip } from "../ui/Chip";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { useBack } from "./back";
import { Curve } from "./Curve";
import { Group, Row } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

export function Weight() {
  const theme = useTheme();
  const router = useRouter();
  const back = useBack();
  const { dogs } = useGassi();
  const active = dogs.filter((d) => !d.archived);
  const [chosen, setChosen] = useState<number | null>(null);
  const dogId = chosen ?? active[0]?.id ?? null;
  const [kg, setKg] = useState("");
  const { data, error, reload } = useServer((a) => a.weights());
  const { message, run } = useWrite();

  const mine = (data?.weights ?? []).filter((w) => dogId === null || w.dogIds.includes(dogId));
  const points = mine.map((w) => ({ at: Date.parse(w.at), kg: (w.amountG ?? 0) / 1000 }));
  const save = () =>
    void run(async (api) => {
      await api.logWeight({ kg, ...(dogId !== null ? { dogIds: [dogId] } : {}) });
      setKg("");
      reload();
    }, "Eingetragen.");

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
          {data && mine.length === 0 ? <Text style={[styles.small, { color: theme.muted }]}>Noch kein Gewicht eingetragen.</Text> : null}
          {mine.length ? (
            <>
              <Text style={[styles.now, { color: theme.ink }]}>{formatKg(mine[0].amountG ?? 0)}</Text>
              <Curve points={points} height={120} />
              <View testID="weight-list">
                <Group>
                  {mine.map((w) => (
                    <Row key={w.id} label={dayHeading(Date.parse(w.at), TIME_ZONE)} value={`${formatKg(w.amountG ?? 0)} · ${w.byName}`} onPress={() => router.push(`/eintrag/${w.id}`)} />
                  ))}
                </Group>
              </View>
            </>
          ) : null}
        </>
      }
      bottom={
        <>
          {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
          <Field label="Gewicht in kg" value={kg} onChangeText={setKg} placeholder="z. B. 12,4" inputMode="decimal" keyboardType="decimal-pad" onSubmitEditing={() => kg.trim() && save()} />
          <BigButton kind="walk" size="l" label="Eintragen" disabled={!kg.trim()} onPress={save} />
          <BigButton kind="neutral" size="m" label="Zurück" onPress={back} />
        </>
      }
      topMin={170}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  now: { fontSize: 30, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  message: { fontSize: 15, fontWeight: "600" },
});
