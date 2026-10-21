// Read at the top, tap at the bottom: the top area scrolls, the bottom area stays put for the buttons.
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, useTheme } from "../theme";

export function Screen({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView style={styles.top} contentContainerStyle={styles.topContent}>
        {top}
      </ScrollView>
      {bottom ? <View style={[styles.bottom, { paddingBottom: space.gutter + insets.bottom }]}>{bottom}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flex: 1 },
  topContent: { padding: space.gutter, gap: space.gap },
  bottom: { paddingHorizontal: space.gutter, paddingTop: space.gap, gap: space.gap },
});
