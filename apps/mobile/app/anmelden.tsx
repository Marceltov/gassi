// Sign-in for a browser without a device token: the code from an invitation, or the household's OIDC provider.
// On an iPhone outside the home-screen app, a hint how to add it there (it doesn't share Safari's storage, so the
// code signs it in again there).
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { OIDC_START, signInOptions } from "@/src/data/signin";
import { SignIn } from "@/src/signin/SignIn";
import { useTheme } from "@/src/theme";
import { BigButton } from "@/src/ui/BigButton";

function iosBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone;
}

export default function SignInScreen() {
  const theme = useTheme();
  const [oidc, setOidc] = useState(false);
  useEffect(() => {
    void signInOptions().then((o) => setOidc(o.oidc));
  }, []);
  return (
    <SignIn
      hint={
        iosBrowser() ? (
          <Text style={[styles.hint, { color: theme.muted }]}>Tipp: In Safari „Teilen“ → „Zum Home-Bildschirm“ tippen. Dann startet Gassi wie eine App – dort mit dem Code anmelden.</Text>
        ) : null
      }
      extra={oidc ? <BigButton kind="neutral" size="m" label="Mit authentik anmelden" onPress={() => window.location.assign(OIDC_START)} /> : null}
    />
  );
}

const styles = StyleSheet.create({ hint: { fontSize: 14, lineHeight: 20 } });
