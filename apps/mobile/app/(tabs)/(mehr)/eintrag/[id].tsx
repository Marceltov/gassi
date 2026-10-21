import { useLocalSearchParams } from "expo-router";
import { EntryDetail } from "@/src/history/EntryDetail";

// /eintrag/<id> on the Mehr tab: a weight from Gewicht
export default function EintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryDetail key={id} id={Number(id)} />;
}
