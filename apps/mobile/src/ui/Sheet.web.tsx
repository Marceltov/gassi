// The web's bottom sheet: a fixed backdrop and a panel at the bottom, closed by a tap outside or Escape.
// Rendered into document.body so it sits above the tab bar, whatever screen opens it.
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pressable, StyleSheet, View } from "react-native";
import { radius, space, useTheme } from "../theme";

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children?: ReactNode }) {
  const theme = useTheme();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.background }]}>
        {children}
      </View>
    </View>,
    document.body,
  );
}

const styles = StyleSheet.create({
  overlay: { position: "fixed" as "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", zIndex: 1000 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.gutter,
    gap: space.gap,
  },
});
