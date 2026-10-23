// Mehr: the data first (Gewicht, Vorrat), then the settings (Hunde, Übungen, Leckerli; Haushalt; Meine Geräte) and
// the Garmin watch, which comes later. Each row says in short what is behind it; without reception the rows that need
// the server stay without that line. Then Wünsche und Fehler (when the server has GitHub set up) and the link to the
// source code, which the AGPL asks a server to offer its users, and last Abmelden on this device (asked first). Its
// screens have no Zurück: the tab bar stays, and the Mehr tab leads back here.
import { formatAgo, formatKg, stockSummary } from "@gassi/domain";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { Screen } from "../ui/Screen";
import { Group, Row } from "../ui/List";
import { SignOutSheet } from "./SignOut";
import { useServer } from "./useServer";

// "1 Übung", "5 Übungen", "keine"
const count = (n: number, one: string, many: string) => (n === 0 ? "keine" : `${n} ${n === 1 ? one : many}`);

// A modified Gassi run for others points this at its own source.
const SOURCE = "https://github.com/Marceltov/gassi";

export function More() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow(60_000);
  const { people, dogs, me, household } = useGassi();
  const { data } = useServer((api) => Promise.all([api.weights(), api.stock(), api.devices(), api.exercises(), api.treatKinds()]));
  const [weights, stock, devices, exercises, treats] = data ?? [null, null, null, null, null];
  // asked again once the household says the server has GitHub set up (a first start knows it only then)
  const github = !!household?.issues;
  const { data: issues, reload: reloadIssues } = useServer((api) => (github ? api.issues() : Promise.resolve(null)));
  useEffect(() => {
    if (github) reloadIssues();
  }, [github, reloadIssues]);

  const active = dogs.filter((d) => !d.archived);
  const newest = weights?.weights[0];
  const weightDog = newest && active.length > 1 ? `${dogs.find((d) => d.id === newest.dogIds[0])?.name ?? "Hund"} ` : "";
  const weight = newest ? `${weightDog}${formatKg(newest.amountG ?? 0)} · ${formatAgo(Date.parse(newest.at), now)}` : weights ? "noch keins" : undefined;
  const food = stock ? (stockSummary(stock) ?? "noch nichts eingetragen") : undefined;
  const others = people.filter((p) => p.id !== me?.id).map((p) => p.name);
  const go = (path: Href) => () => router.push(path);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Mehr</Text>}
      top={
        <>
          <Group>
            <Row testID="more-Gewicht" icon="weight" tone="weight" label="Gewicht" value={weight} onPress={go("/mehr/gewicht")} />
            <Row testID="more-Vorrat" icon="stock" tone="food" label="Vorrat" value={food} onPress={go("/mehr/vorrat")} />
          </Group>
          <Group>
            <Row testID="more-Hunde" icon="dog" tone="walk" label="Hunde" value={active.map((d) => d.name).join(", ")} onPress={go("/mehr/hunde")} />
            <Row testID="more-Uebungen" icon="training" tone="training" label="Übungen" value={exercises ? count(exercises.exercises.length, "Übung", "Übungen") : undefined} onPress={go("/mehr/uebungen")} />
            <Row testID="more-Leckerli" icon="treat" tone="treat" label="Leckerli" value={treats ? count(treats.treatKinds.length, "Sorte", "Sorten") : undefined} onPress={go("/mehr/leckerli")} />
          </Group>
          <Group>
            <Row testID="more-Haushalt" icon="people" tone="household" label="Haushalt" value={[me?.name, ...others].filter(Boolean).join(", ") + " · einladen"} onPress={go("/mehr/haushalt")} />
            <Row testID="more-Geraete" icon="phone" tone="device" label="Meine Geräte" value={devices ? `${devices.devices.length} angemeldet` : undefined} onPress={go("/mehr/geraete")} />
            <Row testID="more-Garmin-Uhr" icon="watch" tone="garmin" label="Garmin-Uhr" value="kommt später" muted />
          </Group>
          <Group>
            {github ? <Row testID="more-Wuensche" icon="feedback" label="Wünsche und Fehler" value={issues ? `${issues.issues.filter((i) => i.open).length} offen` : undefined} onPress={go("/mehr/wuensche")} /> : null}
            <Row testID="more-Quellcode" icon="code" label="Quellcode" value="AGPL-3.0 · GitHub" onPress={() => void Linking.openURL(SOURCE)} />
          </Group>
          <Group>
            <Row testID="more-Abmelden" icon="signOut" label="Abmelden" value={me ? `${me.name} auf diesem Gerät` : undefined} onPress={() => setSigningOut(true)} />
          </Group>
          <SignOutSheet open={signingOut} onClose={() => setSigningOut(false)} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
});
