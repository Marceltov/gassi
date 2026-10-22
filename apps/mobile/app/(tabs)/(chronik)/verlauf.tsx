import { History } from "@/src/history/History";
import { useNoSeededParams } from "@/src/ui/useNoSeededParams";

const KEEP = ["type"];

export default function VerlaufScreen() {
  useNoSeededParams(KEEP);
  return <History />;
}
