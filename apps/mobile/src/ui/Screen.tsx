// A page's title stays at the top (`head`), its buttons stay at the bottom (`bottom`), and the content between them
// (`top`) scrolls when it doesn't fit (#71). All keep the gutter plus the safe area from the sides (the rounded
// corners, a notch in landscape). The bottom keeps clear of the home indicator, except on a tab (every screen of the
// signed-in app): the tab bar below does that. With `fill` the top doesn't scroll but takes the height that is there,
// for a screen that scales to it (Gewicht). In the scrolling top a part with `flex: 1` takes the height that is left
// (Woche's map), and the top scrolls once it is at its least.
import { BottomTabBarHeightContext } from "expo-router/tabs";
import { type ReactNode, useContext } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, useTheme } from "../theme";
import { useEdges } from "./edges";

/** `topMin`: how much of the top stays readable when a tall bottom has to give way (the clock, a summary line). */
/** `low`: the top's content sits at its bottom, right above the controls, while it is shorter than the space (rows
 * you work in, Vorrat's counts). */
export function Screen({ head, top, bottom, topMin, fill, low }: { head?: ReactNode; top: ReactNode; bottom?: ReactNode; topMin?: number; fill?: boolean; low?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const edges = useEdges();
  const onTab = useContext(BottomTabBarHeightContext) !== undefined;
  const sides = { paddingLeft: edges.left(space.gutter), paddingRight: edges.right(space.gutter) };
  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {head ? (
        <View testID="screen-head" style={[styles.head, sides]}>
          {head}
        </View>
      ) : null}
      {fill ? (
        <View testID="screen-fill" style={[styles.top, styles.topContent, styles.fill, sides, { minHeight: topMin }]}>
          {top}
        </View>
      ) : (
        <ScrollView testID="screen-scroll" style={[styles.top, { minHeight: topMin }]} contentContainerStyle={[styles.topContent, head ? styles.underHead : null, low ? styles.low : null, sides]}>
          {top}
        </ScrollView>
      )}
      {bottom ? <View style={[styles.bottom, sides, { paddingBottom: onTab ? space.gutter : edges.bottom(space.gutter) }]}>{bottom}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flex: 1 },
  topContent: { flexGrow: 1, padding: space.gutter, gap: space.gap },
  fill: { overflow: "hidden" },
  head: { paddingTop: space.gutter, paddingBottom: space.gap, gap: space.gap },
  underHead: { paddingTop: 0 },
  low: { justifyContent: "flex-end" },
  bottom: { flexShrink: 1, minHeight: 0, paddingTop: space.gap, gap: space.gap },
});
