import { useLocalSearchParams } from "expo-router";
import { Summary } from "@/src/walk/Summary";

// /runde/<walk key> on the Start tab right after Zuhause
export default function RundeSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Summary key={id} idOrKey={id} />;
}
