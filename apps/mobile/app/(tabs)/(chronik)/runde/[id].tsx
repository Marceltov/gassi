import { type Href, Redirect, useLocalSearchParams } from "expo-router";
import { RundeScreen } from "@/src/walk/RundeScreen";

// /runde/<id> on the Verlauf tab: a walk opened from Verlauf (a numeric entry id). A reload or a cold link of a fresh
// summary (id = walk key) resolves here, as the first group, so it goes on to Start's copy, with Start underneath.
export default function RundeVerlaufScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!/^[1-9]\d*$/.test(id)) return <Redirect href={`/(tabs)/(start)/runde/${encodeURIComponent(id)}` as Href} />;
  return <RundeScreen />;
}
