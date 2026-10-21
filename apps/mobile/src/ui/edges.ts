// How far from each screen edge something stays: `extra` plus the safe area there (the home indicator, the rounded
// corners, a notch). Natively the safe area comes from the system (the web has its own in edges.web.ts).
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Edge = (extra?: number) => number;

export function useEdges(): { top: Edge; bottom: Edge; left: Edge; right: Edge } {
  const insets = useSafeAreaInsets();
  return {
    top: (extra = 0) => extra + insets.top,
    bottom: (extra = 0) => extra + insets.bottom,
    left: (extra = 0) => extra + insets.left,
    right: (extra = 0) => extra + insets.right,
  };
}
