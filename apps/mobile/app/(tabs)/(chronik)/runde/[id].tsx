import { useLocalSearchParams } from "expo-router";
import { Summary } from "@/src/walk/Summary";

// /runde/<id> on the Verlauf tab: a walk opened from Verlauf, also where a deep link or a reload opens a summary
export default function RundeSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Summary key={id} idOrKey={id} />;
}
