// Pull to refresh on the web (#122): react-native-web's RefreshControl draws nothing, and the home-screen app on an
// iPhone has no pull of its own. A touch that starts with the page at its top and pulls it down refreshes once the
// round spinner, following the finger at half its way, has come PULL_PX down; it stays until the refresh is done.
// Same interface as PullScroll.tsx ("./PullScroll" means this file on the web, so that one is named with its extension).
import { type ComponentProps, type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import { usePull } from "./pull";
import type * as Native from "./PullScroll.tsx";

const PULL_PX = 64;
const MAX_PX = 96;
const SIZE = 40;

export function PullScroll({ style, ...props }: ComponentProps<typeof ScrollView>) {
  const theme = useTheme();
  const pull = usePull();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [pulled, setPulled] = useState(0);
  // the latest onRefresh (a new one each render) for the listeners, which stay while the pull is there
  const refresh = useRef(pull?.onRefresh);
  useEffect(() => {
    refresh.current = pull?.onRefresh;
  });
  const enabled = !!pull;
  useEffect(() => {
    const node = (scroll.current as unknown as { getScrollableNode(): HTMLElement } | null)?.getScrollableNode();
    if (!node || !enabled) return;
    let from: number | null = null;
    let way = 0;
    const start = (e: TouchEvent) => {
      from = node.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
      way = 0;
    };
    const move = (e: TouchEvent) => {
      if (from === null) return;
      way = Math.min(MAX_PX, Math.max(0, (e.touches[0].clientY - from) / 2));
      setPulled(way);
    };
    const end = () => {
      if (from !== null && way >= PULL_PX) refresh.current?.();
      from = null;
      setPulled(0);
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: true });
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", end);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
    };
  }, [enabled]);

  const refreshing = !!pull?.refreshing;
  const shown = refreshing || pulled > 0;
  return (
    <View style={[styles.wrap, style]}>
      <ScrollView ref={scroll} style={styles.scroll} {...props} />
      {shown ? (
        <View
          testID="pull-spinner"
          pointerEvents="none"
          accessibilityLabel={refreshing ? "Wird aktualisiert" : undefined}
          style={[styles.spinner, { backgroundColor: theme.surface, boxShadow: theme.calm, top: refreshing ? 12 : pulled - SIZE, opacity: refreshing ? 1 : Math.min(1, pulled / PULL_PX) }]}
        >
          <ActivityIndicator color={theme.walk} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  scroll: { flex: 1 },
  spinner: { position: "absolute", alignSelf: "center", width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center" },
});

const sameAsNative: typeof Native = { PullScroll };
void sameAsNative;
