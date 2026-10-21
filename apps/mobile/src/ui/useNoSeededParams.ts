// A tab's first screen (Start, Verlauf, Mehr) takes no params, but a deep link or a reload of a screen above it
// (/runde/5, /eintrag/5) seeds the tab's stack with that screen's params on it too, so going back would show "/?id=5".
// This drops them from its own route (not the focused one: router.setParams would take the id from the entry).
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";

export function useNoSeededParams(): void {
  const navigation = useNavigation();
  const keys = Object.keys(useLocalSearchParams()).sort().join(",");
  useEffect(() => {
    if (keys) navigation.setParams(Object.fromEntries(keys.split(",").map((k) => [k, undefined])) as never);
  }, [keys, navigation]);
}
