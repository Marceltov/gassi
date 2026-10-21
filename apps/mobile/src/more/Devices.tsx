// Meine Geräte: the devices signed in as me (this one first), when each was last seen, and Abmelden for the others on
// top; at the bottom an invitation for another device of mine, and signing out here: the server forgets this device
// (when it can be reached), then this browser forgets it and shows the sign-in.
import type { Output } from "@gassi/api-client";
import { formatAgo } from "@gassi/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { forgetDevice } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { useBack } from "./back";
import { InviteCard, OpenInvites, useInvites } from "./Invite";
import { Group, Row, Small } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Device = Output<"devices">["devices"][number];

const KIND: Record<Device["kind"], string> = { phone: "Handy", watch: "Uhr", web: "Browser", script: "Skript" };

export function Devices() {
  const theme = useTheme();
  const router = useRouter();
  const back = useBack();
  const now = useNow(60_000);
  const { api } = useGassi();
  const { data, error, reload } = useServer((a) => a.devices());
  const { message, run } = useWrite();
  const invites = useInvites("device");
  // the device to sign out after asking: another one, or this one ("here")
  const [asking, setAsking] = useState<Device | "here" | null>(null);

  const devices = [...(data?.devices ?? [])].sort((a, b) => Number(b.current) - Number(a.current));
  const current = devices.find((d) => d.current);
  const seen = (d: Device) => (d.current ? "dieses Gerät" : d.lastSeenAt ? `zuletzt ${formatAgo(Date.parse(d.lastSeenAt), now)}` : "noch nie benutzt");

  const remove = (d: Device) =>
    void run(async () => {
      setAsking(null);
      if (api) await api.removeDevice({ id: d.id });
      reload();
    });
  const signOutHere = async () => {
    setAsking(null);
    // without reception the server keeps the device: it can be removed from another one later
    if (api) {
      const id = current?.id ?? (await api.me().then((m) => m.device.id, () => null));
      if (id !== null) await api.removeDevice({ id }).catch(() => undefined);
    }
    forgetDevice();
    router.replace("/anmelden");
  };

  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Meine Geräte</Text>
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
          {devices.length ? (
            <Group>
              {devices.map((d) => (
                <Row
                  key={d.id}
                  testID={d.current ? "device-current" : `device-${d.id}`}
                  label={d.name}
                  value={`${KIND[d.kind]} · ${seen(d)}`}
                  right={d.current ? null : <Small label="Abmelden" a11y={`${d.name} abmelden`} onPress={() => setAsking(d)} />}
                />
              ))}
            </Group>
          ) : null}
          {invites.shown ? <InviteCard invite={invites.shown} onRevoke={() => invites.shown && invites.revoke(invites.shown.id)} /> : null}
          <OpenInvites invites={invites.open} onRevoke={invites.revoke} />
          <Sheet open={asking !== null} onClose={() => setAsking(null)}>
            <View testID="signout-sheet" style={styles.sheet}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>{asking === "here" ? "Auf diesem Gerät abmelden?" : `${asking?.name ?? ""} abmelden?`}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                {asking === "here" ? "Danach brauchst du einen neuen Link oder Code, um dich hier wieder anzumelden." : "Das Gerät braucht danach einen neuen Link oder Code."}
              </Text>
              <BigButton kind="neutral" size="l" label="Ja, abmelden" onPress={() => (asking === "here" ? void signOutHere() : asking && remove(asking))} />
              <BigButton kind="neutral" size="m" label="Abbrechen" onPress={() => setAsking(null)} />
            </View>
          </Sheet>
        </>
      }
      bottom={
        <>
          {message ?? invites.message ? <Text style={[styles.message, { color: theme.ink }]}>{message ?? invites.message}</Text> : null}
          <BigButton kind="walk" size="l" label="Gerät hinzufügen" onPress={invites.create} />
          <View style={styles.pair}>
            <View style={styles.half}>
              <BigButton kind="neutral" size="m" label="Zurück" onPress={back} />
            </View>
            <View style={styles.half}>
              <BigButton kind="neutral" size="m" label="Hier abmelden" a11y="Auf diesem Gerät abmelden" onPress={() => setAsking("here")} />
            </View>
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  message: { fontSize: 15, fontWeight: "600" },
  pair: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
});
