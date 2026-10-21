// Mehr: the data first (Gewicht, Vorrat), then the settings (Hunde; Übungen und Leckerli; Haushalt; Meine Geräte) and
// the Garmin watch, which comes later. Each row says in short what is behind it; without reception the rows that need
// the server stay without that line.
import { formatAgo, formatKg, stockParts } from "@gassi/domain";
import { type Href, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { Screen } from "../ui/Screen";
import { Group, Row } from "./List";
import { useServer } from "./useServer";

export function More() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow(60_000);
  const { people, dogs, me } = useGassi();
  const { data } = useServer((api) => Promise.all([api.weights(), api.stock(), api.devices()]));
  const [weights, stock, devices] = data ?? [null, null, null];

  const active = dogs.filter((d) => !d.archived);
  const newest = weights?.weights[0];
  const weightDog = newest && active.length > 1 ? `${dogs.find((d) => d.id === newest.dogIds[0])?.name ?? "Hund"} ` : "";
  const weight = newest ? `${weightDog}${formatKg(newest.amountG ?? 0)} · ${formatAgo(Date.parse(newest.at), now)}` : weights ? "noch keins" : undefined;
  const [wet, dry] = stock ? [stockParts(stock, "wet"), stockParts(stock, "dry")] : [null, null];
  // per kind what is left, "aufgebraucht" when it ran out; a kind never entered stays out
  const kindLine = (s: typeof wet, name: string, suffix: string) => (!s ? null : s.empty ? `${name} aufgebraucht` : s.left && `${s.left}${suffix}`);
  const food = stock ? [kindLine(wet, "Nass", ""), kindLine(dry, "Trocken", " trocken")].filter(Boolean).join(" · ") || "noch nichts eingetragen" : undefined;
  const others = people.filter((p) => p.id !== me?.id).map((p) => p.name);
  const go = (path: Href) => () => router.push(path);

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Mehr</Text>
          <Group>
            <Row testID="more-Gewicht" icon="⚖️" label="Gewicht" value={weight} onPress={go("/mehr/gewicht")} />
            <Row testID="more-Vorrat" icon="📦" label="Vorrat" value={food} onPress={go("/mehr/vorrat")} />
          </Group>
          <Group>
            <Row testID="more-Hunde" icon="🐕" label="Hunde" value={active.map((d) => d.name).join(", ")} onPress={go("/mehr/hunde")} />
            <Row testID="more-Katalog" icon="🎯" label="Übungen und Leckerli" value="Listen bearbeiten" onPress={go("/mehr/katalog")} />
          </Group>
          <Group>
            <Row testID="more-Haushalt" icon="👥" label="Haushalt" value={[me?.name, ...others].filter(Boolean).join(", ") + " · einladen"} onPress={go("/mehr/haushalt")} />
            <Row testID="more-Geraete" icon="📱" label="Meine Geräte" value={devices ? `${devices.devices.length} angemeldet` : undefined} onPress={go("/mehr/geraete")} />
            <Row testID="more-Garmin-Uhr" icon="⌚" label="Garmin-Uhr" value="kommt später" muted />
          </Group>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
});
