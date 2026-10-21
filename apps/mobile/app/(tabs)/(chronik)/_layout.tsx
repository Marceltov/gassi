// The Verlauf tab's stack (a group named to sort first, see ../_layout.tsx): the list, an entry, a walk's summary.
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "verlauf" };

export default function VerlaufLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
