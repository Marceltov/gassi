// A panel that slides up from the bottom over a dimmed screen (the web has its own in Sheet.web.tsx).
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { radius, space, useTheme } from "../theme";

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.gutter, gap: space.gap },
});
