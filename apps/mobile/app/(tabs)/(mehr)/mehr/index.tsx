import { More } from "@/src/more/More";
import { useNoSeededParams } from "@/src/ui/useNoSeededParams";

export default function MehrScreen() {
  useNoSeededParams();
  return <More />;
}
