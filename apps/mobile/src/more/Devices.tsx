// Meine Geräte: the devices signed in as me (this one first), when each was last seen, and Abmelden for the others on
// top; at the bottom an invitation for another device of mine, and signing out here (SignOut.tsx).
import type { Output } from "@gassi/api-client";
import { formatAgo } from "@gassi/domain";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNow } from "../start/useNow";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { ButtonRow } from "../ui/ButtonRow";
import { Screen } from "../ui/Screen";
import { Sheet } from "../ui/Sheet";
import { InviteCard, OpenInvites, useInvites } from "./Invite";
import { SignOutSheet } from "./SignOut";
import { Group, Row, Small } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

type Device = Output<"devices">["devices"][number];

const KIND: Record<Device["kind"], string> = { phone: "Handy", watch: "Uhr", web: "Browser", script: "Skript" };

export function Devices() {
  const theme = useTheme();
  const now = useNow(60_000);
  const { data, error, reload } = useServer((a) => a.devices());
  const { message, run } = useWrite();
  const invites = useInvites("device");
  // the other device to sign out after asking, and whether signing out here is asked
  const [asking, setAsking] = useState<Device | null>(null);
  const [askingHere, setAskingHere] = useState(false);

  const devices = [...(data?.devices ?? [])].sort((a, b) => Number(b.current) - Number(a.current));
  const current = devices.find((d) => d.current);
  const seen = (d: Device) => (d.current ? "dieses Gerät" : d.lastSeenAt ? `zuletzt ${formatAgo(Date.parse(d.lastSeenAt), now)}` : "noch nie benutzt");

  const remove = (d: Device) =>
    void run(async (api) => {
      setAsking(null);
      await api.removeDevice({ id: d.id });
      reload();
    });
  return (
    <Screen
      head={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Meine Geräte</Text>
          {error && !data ? <Text style={[styles.small, { color: theme.muted }]}>{error}</Text> : null}
        </>
      }
      top={
        <>
          {devices.length ? (
            <Group>
              {devices.map((d) => (
                <Row
                  key={d.id}
                  testID={d.current ? "device-current" : `device-${d.id}`}
                  icon={d.kind === "watch" ? "watch" : "phone"}
                  tone="device"
                  label={d.name}
                  value={`${KIND[d.kind]} · ${seen(d)}`}
                  right={d.current ? null : <Small danger label="Abmelden" a11y={`${d.name} abmelden`} onPress={() => setAsking(d)} />}
                />
              ))}
            </Group>
          ) : null}
          {invites.shown ? <InviteCard invite={invites.shown} onRevoke={() => invites.shown && invites.revoke(invites.shown.id)} /> : null}
          <OpenInvites invites={invites.open} onRevoke={invites.revoke} />
          <SignOutSheet open={askingHere} onClose={() => setAskingHere(false)} />
          <Sheet open={asking !== null} onClose={() => setAsking(null)} label={`${asking?.name ?? ""} abmelden?`}>
            <View testID="remove-device-sheet" style={styles.sheet}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>{`${asking?.name ?? ""} abmelden?`}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>Das Gerät braucht danach einen neuen Link oder Code.</Text>
              <ButtonRow side={[<BigButton key="no" kind="side" size="m" label="Abbrechen" onPress={() => setAsking(null)} />]} main={<BigButton kind="danger" size="m" label="Ja, abmelden" onPress={() => asking && remove(asking)} />} />
            </View>
          </Sheet>
        </>
      }
      bottom={
        <>
          {message ?? invites.message ? <Text style={[styles.message, { color: theme.ink }]}>{message ?? invites.message}</Text> : null}
          {/* the exception to side by side (#80): signing this phone out is its own row above */}
          <BigButton kind="dangerSide" size="m" label="Hier abmelden" a11y="Auf diesem Gerät abmelden" onPress={() => setAskingHere(true)} />
          <BigButton kind="ink" size="m" icon="add" label="Gerät hinzufügen" onPress={invites.create} />
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
});
