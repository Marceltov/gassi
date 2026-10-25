import "@/src/polyfill";
import { DarkTheme, DefaultTheme, ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps, Stack, ThemeProvider, usePathname } from "expo-router";
import { useEffect } from "react";
import { AppState, useColorScheme } from "react-native";
import { events } from "@/src/data/events";
import { GassiProvider, useGassi } from "@/src/data/GassiProvider";
import { RecordingProvider } from "@/src/track/Recording";

/** An error while drawing a screen: kept for the server (#115), then expo-router's own screen with "Try again". */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => events.error("Anzeige", props.error), [props.error]);
  return <RouterErrorBoundary {...props} />;
}

// The app's start (how long from the JS runtime's start to the first screen) and each time it comes to the front or
// goes behind (#115).
let startTold = false;
AppState.addEventListener("change", (s) => {
  if (s === "active") events.record("app", "foreground");
  else if (s === "background") events.record("app", "background");
});

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GassiProvider>
      <RecordingProvider>
        <ThemeProvider value={colorScheme === "light" ? DefaultTheme : DarkTheme}>
          <Screens />
        </ThemeProvider>
      </RecordingProvider>
    </GassiProvider>
  );
}

// Signed out (no device, or a 401 cleared it), every screen but the sign-in leads to /anmelden; signed in, /anmelden
// leads to Start. /join works either way (a link signs this browser in anew).
function Screens() {
  const { signedIn } = useGassi();
  // which screen is open, as a usage event each time it changes: the address, never what is on it
  const path = usePathname();
  useEffect(() => events.record("screen", path), [path]);
  useEffect(() => {
    if (startTold) return;
    startTold = true;
    events.record("app", "start", { ms: Math.round(performance.now()) });
  }, []);
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
