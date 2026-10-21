// The four tabs: Start, Verlauf, Woche, Mehr. Each but Woche is a stack, so its screens keep the tab bar: Start has
// the walk, its summary and the training; Verlauf (the group "(chronik)") an entry and a walk's summary; Mehr its
// screens and a weight's entry. An entry and a walk's summary are shared routes (the same URL in several tabs): opened
// in the app they stay in the tab they were opened from; a deep link or a reload has no tab to stay in and opens them
// in the group that sorts first, which is why Verlauf's is "(chronik)" (before "(mehr)" and "(start)").
// Tapping the tab that is shown goes back to its first screen (each stack has an anchor, so also after a deep link):
// that is the way back, the screens have no Zurück of their own. Leaving a tab resets its stack too
// (popToTopOnBlur), so a tab always opens at its top page; a running walk is not lost, it lives in the projection and
// Start's Gassi tile reads "Runde läuft".
// The bar keeps clear of the home indicator and the rounded corners: its labels sit right above the safe area, as in
// the iPhone's own apps (49 pt plus the safe area).
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useTheme } from "@/src/theme";
import { useEdges } from "@/src/ui/edges";

/** The bar's own height (icon and label), on top of the safe area. */
const BAR = 49;

const icon = (name: SymbolViewProps["name"]) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  };

export default function TabLayout() {
  const theme = useTheme();
  const edges = useEdges();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        popToTopOnBlur: true,
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          height: edges.bottom(BAR),
          paddingBottom: edges.bottom(),
          paddingLeft: edges.left(),
          paddingRight: edges.right(),
        },
      }}
    >
      <Tabs.Screen name="(start)" options={{ title: "Start", tabBarIcon: icon({ ios: "house", android: "home", web: "home" }) }} />
      <Tabs.Screen name="(chronik)" options={{ title: "Verlauf", tabBarIcon: icon({ ios: "list.bullet", android: "list", web: "list" }) }} />
      <Tabs.Screen name="woche" options={{ title: "Woche", tabBarIcon: icon({ ios: "calendar", android: "calendar_month", web: "calendar_month" }) }} />
      <Tabs.Screen name="(mehr)" options={{ title: "Mehr", tabBarIcon: icon({ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }) }} />
    </Tabs>
  );
}
