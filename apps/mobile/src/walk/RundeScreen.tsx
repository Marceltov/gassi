import { useLocalSearchParams } from "expo-router";
import { Summary } from "./Summary";

// A walk's summary, the one screen behind /runde/<id or walk key> (Start) and /verlauf/runde/<id>
export function RundeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Summary key={id} idOrKey={id} />;
}
