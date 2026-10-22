// The Mehr tab's stack: Mehr, its screens (Gewicht, Vorrat, Hunde, Übungen, Leckerli, Haushalt, Geräte), a weight's
// entry.
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "mehr/index" };

export default function MehrLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
