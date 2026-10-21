import { useLocalSearchParams } from "expo-router";
import { EntryDetail } from "@/src/history/EntryDetail";

// /eintrag/<id> on the Start tab: from the summary right after Zuhause (its time, dogs or to delete it)
export default function EintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryDetail key={id} id={Number(id)} />;
}
