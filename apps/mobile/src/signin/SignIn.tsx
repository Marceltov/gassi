// Signing this browser in, with the code from an invitation (/anmelden) or a link's token (/join). Asks the server
// what the link is for first: a setup or person link needs a name (setup also the first dog), a device link signs in
// at once. The code is sent as typed; the server reads it loosely (case, spaces, dashes).
import { router } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { errorMessage } from "@/src/data/api";
import { type LinkKey, type LinkKind, linkKind, needsName, signIn } from "@/src/data/signin";
import { radius, space, useTheme } from "@/src/theme";
import { BigButton } from "@/src/ui/BigButton";
import { Screen } from "@/src/ui/Screen";

const userAgent = () => (Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.userAgent : Platform.OS);

/** `token` (from /join): sign in with that link; else a field for the code. `extra`: more ways to sign in. */
export function SignIn({ token, extra, hint }: { token?: string; extra?: ReactNode; hint?: ReactNode }) {
  const theme = useTheme();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<LinkKind | null>(null);
  const [personName, setPersonName] = useState("");
  const [dogName, setDogName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const key: LinkKey | null = token ? { token } : code.trim() ? { code } : null;
  const asking = kind !== null && needsName(kind);

  async function submit(k: LinkKey | null = key) {
    if (!k || busy) return;
    setBusy(true);
    setError(null);
    try {
      let known = kind;
      if (known === null) {
        known = await linkKind(k);
        setKind(known);
      }
      // a new person: first ask for the name, then sign in
      if (needsName(known) && !personName.trim()) {
        if (kind !== null) setError("Wie heißt du?");
        return;
      }
      await signIn(k, { personName, dogName: known === "setup" ? dogName : undefined }, userAgent());
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // a link from /join: ask at once what it is for (and sign in, if it needs no name)
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void submit({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const input = [styles.input, { backgroundColor: theme.surface, color: theme.ink, borderColor: theme.line }];
  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Gassi</Text>
          <Text style={[styles.text, { color: theme.ink }]}>
            {asking ? "Willkommen! Wie heißt du?" : token ? "Einen Moment …" : "Gib den Code aus deiner Einladung ein."}
          </Text>
          {hint}
          {error ? (
            <Text accessibilityRole="alert" style={[styles.text, { color: theme.pee }]}>
              {error}
            </Text>
          ) : null}
        </>
      }
      bottom={
        <>
          {token ? null : (
            <TextInput
              accessibilityLabel="Code"
              placeholder="Code, z. B. AB12-CD34"
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                setKind(null); // another code may be another kind of link
              }}
              onSubmitEditing={() => void submit()}
              style={input}
            />
          )}
          {asking ? (
            <TextInput accessibilityLabel="Dein Name" placeholder="Dein Name" placeholderTextColor={theme.muted} autoFocus value={personName} onChangeText={setPersonName} onSubmitEditing={() => void submit()} style={input} />
          ) : null}
          {asking && kind === "setup" ? (
            <TextInput accessibilityLabel="Name deines Hundes" placeholder="Name deines Hundes" placeholderTextColor={theme.muted} value={dogName} onChangeText={setDogName} onSubmitEditing={() => void submit()} style={input} />
          ) : null}
          {!token || asking ? (
            <BigButton kind="walk" size="l" icon="signIn" label={busy ? "Einen Moment …" : "Anmelden"} onPress={() => void submit()} />
          ) : error ? (
            <BigButton kind="neutral" size="l" label="Zur Anmeldung" onPress={() => router.replace("/anmelden")} />
          ) : null}
          {extra}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", marginTop: 24 },
  text: { fontSize: 16, lineHeight: 22 },
  input: { height: 52, borderRadius: radius.tile, borderWidth: 1, paddingHorizontal: space.gutter, fontSize: 17 },
});

/** The token from /join that failed, or the sign-in (OIDC) that didn't work: a way back to /anmelden. */
export function SignInFailed({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <Screen
      top={
        <>
          <Text style={[styles.title, { color: theme.ink }]}>Gassi</Text>
          <Text accessibilityRole="alert" style={[styles.text, { color: theme.ink }]}>
            {message}
          </Text>
        </>
      }
      bottom={<BigButton kind="neutral" size="l" label="Zur Anmeldung" onPress={() => router.replace("/anmelden")} />}
    />
  );
}
