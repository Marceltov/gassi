// Read at the top, tap at the bottom: the top area scrolls, the bottom area stays put for the buttons. Both keep the
// gutter plus the safe area from the sides (the rounded corners, a notch in landscape). The bottom keeps clear of the
// home indicator, except on a tab (every screen of the signed-in app): the tab bar below does that.
import { BottomTabBarHeightContext } from "expo-router/tabs";
import { type ReactNode, useContext } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, useTheme } from "../theme";
import { useEdges } from "./edges";

/** `topMin`: how much of the top stays readable when a tall bottom has to give way (the clock, a summary line). */
export function Screen({ top, bottom, topMin }: { top: ReactNode; bottom?: ReactNode; topMin?: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const edges = useEdges();
  const onTab = useContext(BottomTabBarHeightContext) !== undefined;
  const sides = { paddingLeft: edges.left(space.gutter), paddingRight: edges.right(space.gutter) };
  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView style={[styles.top, { minHeight: topMin }]} contentContainerStyle={[styles.topContent, sides]}>
        {top}
      </ScrollView>
      {bottom ? <View style={[styles.bottom, sides, { paddingBottom: onTab ? space.gutter : edges.bottom(space.gutter) }]}>{bottom}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flex: 1 },
  topContent: { padding: space.gutter, gap: space.gap },
  bottom: { flexShrink: 1, minHeight: 0, paddingTop: space.gap, gap: space.gap },
});
