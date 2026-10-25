// Sign-in for a device without a device token: the code from an invitation, or the household's OIDC provider. The
// web app signs in to the server that serves it; the Android app asks for the server's address above the code. On an
// iPhone outside the home-screen app, a hint how to add it there (it doesn't share Safari's storage, so the code signs
// it in again there).
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { API_URL } from "@/src/data/api";
import { signInOptions, typedServer } from "@/src/data/signin";
import { startOidc } from "@/src/signin/oidc";
import { SignIn } from "@/src/signin/SignIn";
import { radius, space, useTheme } from "@/src/theme";
import { BigButton } from "@/src/ui/BigButton";

function iosBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone;
}

export default function SignInScreen() {
  const theme = useTheme();
  const web = Platform.OS === "web";
  const [typed, setTyped] = useState("");
  // the server follows the field as it is typed: on Android the first tap on "Anmelden" may only close the keyboard,
  // so the field's end of editing can come too late
  const server = web ? API_URL : typedServer(typed);
  // what the server offers, kept with the server it came from: another address asks again
  const [options, setOptions] = useState<{ server: string; oidc: boolean } | null>(null);
  const oidc = options?.server === server && options.oidc;
  useEffect(() => {
    if (server === null) return;
    let alive = true; // the sign-in may be left (a link signs in), or the server changed, before the answer comes
    // asked once typing pauses, not at every letter
    const asking = setTimeout(() => void signInOptions(server).then((o) => alive && setOptions({ server, oidc: o.oidc })), web ? 0 : 500);
    return () => {
      alive = false;
      clearTimeout(asking);
    };
  }, [server, web]);
  return (
    <SignIn
      server={server}
      above={
        web ? null : (
          <TextInput
            accessibilityLabel="Server"
            placeholder="gassi.example.org"
            placeholderTextColor={theme.muted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            value={typed}
            onChangeText={setTyped}
            style={[styles.input, { backgroundColor: theme.surface, color: theme.ink, borderColor: theme.line }]}
          />
        )
      }
      hint={
        iosBrowser() ? (
          <Text style={[styles.hint, { color: theme.muted }]}>Tipp: In Safari „Teilen“ → „Zum Home-Bildschirm“ tippen. Dann startet Gassi wie eine App – dort mit dem Code anmelden.</Text>
        ) : null
      }
      extra={oidc ? <BigButton kind="neutral" size="m" label="Mit authentik anmelden" onPress={() => server !== null && void startOidc(server)} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, lineHeight: 20 },
  input: { height: 52, borderRadius: radius.tile, borderWidth: 1, paddingHorizontal: space.gutter, fontSize: 17 },
});
