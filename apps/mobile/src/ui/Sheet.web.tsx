// The web's bottom sheet: a fixed backdrop and a panel at the bottom, closed by a tap outside, Escape or leaving the
// screen (another tab); a modal dialog for screen readers. Rendered into document.body, whatever screen opens it, and
// there it ends where the tab bar begins, so the bar stays visible and tappable; off a tab (the sign-in) the panel
// keeps clear of the home indicator itself (the page runs with viewport-fit=cover). Named by `label` (its title);
// opening moves the focus to its first button, closing gives it back to what had it (the button that opened it).
import { BottomTabBarHeightContext } from "expo-router/tabs";
import { type ReactNode, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pressable, StyleSheet, View } from "react-native";
import { radius, space, useTheme } from "../theme";
import { useEdges } from "./edges";
import { useCloseOnBlur } from "./useCloseOnBlur";

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label?: string; children?: ReactNode }) {
  const theme = useTheme();
  const panel = useRef<HTMLElement | null>(null);
  const tabBar = useContext(BottomTabBarHeightContext); // the bar's measured height, undefined off a tab
  const edges = useEdges();
  useCloseOnBlur(open, onClose);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // after the portal is in the page: the first button inside (the backdrop is outside the panel)
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role="button"], button, input, textarea')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <View testID="sheet-overlay" style={[styles.overlay, { bottom: tabBar ?? 0 }]}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <View ref={panel as never} role="dialog" aria-modal aria-label={label} style={[styles.sheet, { backgroundColor: theme.background, paddingLeft: edges.left(space.gutter), paddingRight: edges.right(space.gutter), paddingBottom: tabBar === undefined ? edges.bottom(space.gutter) : space.gutter }]}>
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
