import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";
import { GassiProvider, useGassi } from "@/src/data/GassiProvider";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GassiProvider>
      <ThemeProvider value={colorScheme === "light" ? DefaultTheme : DarkTheme}>
        <Screens />
      </ThemeProvider>
    </GassiProvider>
  );
}

// Signed out (no device, or a 401 cleared it), every screen but the sign-in leads to /anmelden; signed in, /anmelden
// leads to Start. /join works either way (a link signs this browser in anew).
function Screens() {
  const { signedIn } = useGassi();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/anmelden">
        {/* every screen of the signed-in app lives in a tab, so the tab bar stays (app/(tabs)/_layout.tsx) */}
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="anmelden" />
      </Stack.Protected>
      <Stack.Screen name="join" />
    </Stack>
  );
}
