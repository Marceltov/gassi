import { useLocalSearchParams } from "expo-router";
import { Summary } from "./Summary";

// /runde/<id>: a walk's summary, the one screen behind both route files (Start's and Verlauf's)
export function RundeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Summary key={id} idOrKey={id} />;
}
