// The Mehr tab's stack: Mehr and its screens (Gewicht, Vorrat, Hunde, Übungen, Leckerli, Haushalt, Geräte, Wünsche und
// Fehler).
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "mehr/index" };

export default function MehrLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
