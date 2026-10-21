import { History } from "@/src/history/History";
import { useNoSeededParams } from "@/src/ui/useNoSeededParams";

export default function VerlaufScreen() {
  useNoSeededParams();
  return <History />;
}
