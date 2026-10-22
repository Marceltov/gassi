// The Verlauf tab's stack, all under /verlauf: the list, an entry, a walk's summary.
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "verlauf/index" };

export default function VerlaufLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
