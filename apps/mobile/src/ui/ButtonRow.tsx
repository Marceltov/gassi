// The buttons at the bottom of a page off the go, side by side (#80): side actions left, each as wide as its label, the
// main action right taking the rest, all one height. A trash button (Löschen) is square: only its icon.
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BigButton } from "./BigButton";

const HEIGHT = { s: 44, m: 52 } as const;

/** `side`: the side actions, left to right (a `TrashButton` among them stays square); `main`: the main action. */
export function ButtonRow({ side, main }: { side: ReactNode[]; main: ReactNode }) {
  return (
    <View style={styles.row}>
      {side.filter(Boolean).map((s, i) => (
        <View key={i} style={isTrash(s) ? null : styles.side}>
          {s}
        </View>
      ))}
      <View style={styles.main}>{main}</View>
    </View>
  );
}

/** Löschen as a square trash icon outlined in red; `size` as the main action's, so the row keeps one height. */
export function TrashButton({ onPress, label = "Löschen", size = "m" }: { onPress: () => void; label?: string; size?: keyof typeof HEIGHT }) {
  return (
    <View style={{ width: HEIGHT[size] }}>
      <BigButton kind="dangerSide" size={size} icon="trash" label="" a11y={label} onPress={onPress} />
    </View>
  );
}

const isTrash = (n: ReactNode) => typeof n === "object" && n !== null && "type" in n && n.type === TrashButton;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  side: { flexShrink: 0, minWidth: 96 },
  main: { flex: 1 },
});
