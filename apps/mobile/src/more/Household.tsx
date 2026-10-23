// Haushalt: who is in it, the invitation just made and the open ones on top; Person einladen at the bottom. With an
// OIDC provider the provider decides who is in, so there is no person invitation then.
import { StyleSheet, Text, View } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Screen } from "../ui/Screen";
import { InviteCard, OpenInvites, useInvites } from "./Invite";
import { Group, Row } from "../ui/List";

export function Household() {
  const theme = useTheme();
  const { people, me, household } = useGassi();
  const { shown, open, create, revoke, message } = useInvites("person");
  const oidc = !!household?.oidc;

  return (
    <Screen
      head={<Text style={[styles.title, { color: theme.ink }]}>Haushalt</Text>}
      top={
        <>
          <View testID="members">
            <Group title="Dabei">
              {people.map((p) => (
                <Row key={p.id} icon="people" tone="household" label={p.name} value={p.id === me?.id ? "du" : undefined} />
              ))}
            </Group>
          </View>
          {shown ? <InviteCard invite={shown} onRevoke={() => revoke(shown.id)} /> : null}
          <OpenInvites invites={open} onRevoke={revoke} />
          {oidc ? <Text style={[styles.small, { color: theme.muted }]}>Neue Personen melden sich über die Anmeldung des Haushalts an (OIDC).</Text> : null}
        </>
      }
      bottom={
        <>
          {message ? <Text style={[styles.message, { color: theme.ink }]}>{message}</Text> : null}
          {!oidc ? <BigButton kind="ink" size="m" icon="invite" label="Person einladen" onPress={create} /> : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  small: { fontSize: 13 },
  message: { fontSize: 15, fontWeight: "600" },
});
