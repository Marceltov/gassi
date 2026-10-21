import { Start } from "@/src/start/Start";
import { useNoSeededParams } from "@/src/ui/useNoSeededParams";

export default function StartScreen() {
  useNoSeededParams();
  return <Start />;
}
