import { useLocalSearchParams } from "expo-router";
import { Summary } from "@/src/walk/Summary";

// /runde/<id> from Verlauf, /runde/<walk key> right after Zuhause
export default function RundeSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Summary key={id} idOrKey={id} />;
}
