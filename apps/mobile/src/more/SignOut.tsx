// Signing out on this device, asked first: the server forgets this device (when it can be reached within a few
// seconds), then this browser forgets it and shows the sign-in. Used by Mehr's last row and by Meine Geräte.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { forgetDevice } from "../data/api";
import { useGassi } from "../data/GassiProvider";
import { useTheme } from "../theme";
import { BigButton } from "../ui/BigButton";
import { Sheet } from "../ui/Sheet";

/** How long signing out here waits for the server before it signs out locally anyway. */
const SIGN_OUT_WAIT_MS = 3000;
const TITLE = "Auf diesem Gerät abmelden?";

export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { writeApi } = useGassi();
  const signOut = async () => {
    onClose();
    // without reception (or an answer within SIGN_OUT_WAIT_MS) the server keeps the device: it can be removed from
    // another one later; this browser signs out either way
    if (writeApi) {
      const removeHere = async () => writeApi.removeDevice({ id: (await writeApi.me()).device.id });
      await Promise.race([removeHere().catch(() => undefined), new Promise((r) => setTimeout(r, SIGN_OUT_WAIT_MS))]);
    }
    forgetDevice();
    router.replace("/anmelden");
  };
  return (
    <Sheet open={open} onClose={onClose} label={TITLE}>
      <View testID="signout-sheet" style={styles.sheet}>
        <Text style={[styles.title, { color: theme.ink }]}>{TITLE}</Text>
        <Text style={[styles.small, { color: theme.muted }]}>Danach brauchst du einen neuen Link oder Code, um dich hier wieder anzumelden.</Text>
        <BigButton kind="neutral" size="l" label="Ja, abmelden" onPress={() => void signOut()} />
        <BigButton kind="neutral" size="m" label="Abbrechen" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 10 },
  title: { fontSize: 17, fontWeight: "700" },
  small: { fontSize: 13 },
});
