// The four tabs: Start, Verlauf, Woche, Mehr.
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

const icon = (name: SymbolViewProps["name"]) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  };

export default function TabLayout() {
  const colors = Colors[useColorScheme()];
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: "Start", tabBarIcon: icon({ ios: "house", android: "home", web: "home" }) }} />
      <Tabs.Screen name="verlauf" options={{ title: "Verlauf", tabBarIcon: icon({ ios: "list.bullet", android: "list", web: "list" }) }} />
      <Tabs.Screen name="woche" options={{ title: "Woche", tabBarIcon: icon({ ios: "calendar", android: "calendar_month", web: "calendar_month" }) }} />
      <Tabs.Screen name="mehr" options={{ title: "Mehr", tabBarIcon: icon({ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }) }} />
    </Tabs>
  );
}
