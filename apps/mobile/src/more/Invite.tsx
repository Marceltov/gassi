// An invitation as Haushalt (a new person) and Meine Geräte (another device of mine) make it: the link, the code to
// type into the app's sign-in (shown only now: the server keeps just its hash) and until when it holds; copy buttons
// where the platform can copy, and Zurückziehen. Below, the invitations still open, each to take back.
import type { Output } from "@gassi/api-client";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, useTheme } from "../theme";
import { dayTime } from "../time";
import { canCopy, copyText } from "../ui/copy";
import { Group, Row, Small } from "./List";
import { useServer } from "./useServer";
import { useWrite } from "./useWrite";

export type InviteKind = "person" | "device";
type Created = Output<"createInvite">;

const KIND_LABEL: Record<string, string> = { person: "Person", device: "Gerät", watch: "Uhr" };

/** The invitation just made (or null), the open ones of `kind`, and how to make and take back one. */
export function useInvites(kind: InviteKind) {
  const { data, reload } = useServer((a) => a.invites());
  const { message, setMessage, run } = useWrite();
  const [shown, setShown] = useState<Created | null>(null);
  const create = () =>
    void run(async (api) => {
      setShown(await api.createInvite({ kind }));
      reload();
    });
  const revoke = (id: number) =>
    void run(async (api) => {
      await api.revokeInvite({ id });
      if (shown?.id === id) setShown(null);
      reload();
    });
  const open = (data?.invites ?? []).filter((i) => i.kind === kind && i.id !== shown?.id);
  return { shown, open, create, revoke, message, setMessage };
}

export function InviteCard({ invite, onRevoke }: { invite: Created; onRevoke: () => void }) {
  const theme = useTheme();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: string, text: string) => setCopied((await copyText(text)) ? `${what} kopiert.` : "Kopieren ging nicht – bitte von Hand.");
  return (
    <View testID="invite" style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.small, { color: theme.muted }]}>Code für die Anmeldung in der App</Text>
      <Text testID="invite-code" selectable style={[styles.code, { color: theme.ink }]}>
        {invite.code}
      </Text>
      <Text style={[styles.small, { color: theme.muted }]}>oder den Link öffnen</Text>
      <Text testID="invite-link" selectable style={[styles.link, { color: theme.ink }]}>
        {invite.url}
      </Text>
      <Text style={[styles.small, { color: theme.muted }]}>{`gilt bis ${dayTime(invite.expiresAt)} · nur einmal`}</Text>
      <View style={styles.actions}>
        {canCopy() ? (
          <>
            <Small label="Link kopieren" onPress={() => void copy("Link", invite.url)} />
            <Small label="Code kopieren" onPress={() => void copy("Code", invite.code)} />
          </>
        ) : null}
        <Small label="Zurückziehen" onPress={onRevoke} />
      </View>
      {copied ? <Text style={[styles.small, { color: theme.ink }]}>{copied}</Text> : null}
    </View>
  );
}

export function OpenInvites({ invites, onRevoke }: { invites: { id: number; kind: string; expiresAt: string }[]; onRevoke: (id: number) => void }) {
  if (!invites.length) return null;
  return (
    <Group title="Offene Einladungen">
      {invites.map((i) => (
        <Row key={i.id} label={KIND_LABEL[i.kind] ?? i.kind} value={`bis ${dayTime(i.expiresAt)}`} right={<Small label="Zurückziehen" a11y={`Einladung bis ${dayTime(i.expiresAt)} zurückziehen`} onPress={() => onRevoke(i.id)} />} />
      ))}
    </Group>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.tile, padding: 14, gap: 4 },
  small: { fontSize: 13 },
  code: { fontSize: 30, fontWeight: "700", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  link: { fontSize: 14 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
});
