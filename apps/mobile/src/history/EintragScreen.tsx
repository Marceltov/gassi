import { useLocalSearchParams } from "expo-router";
import { EntryDetail } from "./EntryDetail";

// An entry's detail, the one screen behind /eintrag/<id> (Start) and /verlauf/eintrag/<id>
export function EintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryDetail key={id} id={Number(id)} />;
}
