import { useLocalSearchParams } from "expo-router";
import { EntryDetail } from "./EntryDetail";

// /eintrag/<id>: an entry's detail, the one screen behind the route files of Start, Verlauf and Mehr
export function EintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryDetail key={id} id={Number(id)} />;
}
