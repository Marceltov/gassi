// A panel that slides up from the bottom over a dimmed screen (the web has its own in Sheet.web.tsx). On a tab it ends
// where the tab bar begins, so the bar stays visible (a tap there closes the sheet, the modal takes the touches); off a
// tab it keeps clear of the home indicator itself. It closes when its screen loses the focus.
import { BottomTabBarHeightContext } from "expo-router/tabs";
import { type ReactNode, useContext } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { radius, space, useTheme } from "../theme";
import { useEdges } from "./edges";
import { useCloseOnBlur } from "./useCloseOnBlur";

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label?: string; children?: ReactNode }) {
  const theme = useTheme();
  const tabBar = useContext(BottomTabBarHeightContext);
  const edges = useEdges();
  useCloseOnBlur(open, onClose);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <View accessibilityLabel={label} accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.background, paddingLeft: edges.left(space.gutter), paddingRight: edges.right(space.gutter), paddingBottom: tabBar === undefined ? edges.bottom(space.gutter) : space.gutter }]}>
        {children}
      </View>
      {tabBar ? <Pressable style={{ height: tabBar }} onPress={onClose} accessible={false} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.gutter, gap: space.gap },
});
