import { useLocalSearchParams } from "expo-router";
import { EntryDetail } from "@/src/history/EntryDetail";

// /eintrag/<id> on the Verlauf tab, also where a deep link or a reload opens it: from Verlauf and from a walk's summary
// there (its time, dogs or to delete it)
export default function EintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryDetail key={id} id={Number(id)} />;
}
