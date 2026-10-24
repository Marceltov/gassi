// What went wrong with the server other than reception (GassiState.syncError), at the top of every screen, while
// the app is being built: a sync that fails without a word looks like data that is simply missing. Gone again once
// the part that failed works; removed from the app once syncing has proven itself.
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useGassi } from "../data/GassiProvider";
import { radius, space, useTheme } from "../theme";
import { Icon } from "./Icon";

/** `style`: the screen's sides. */
export function SyncBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { syncError } = useGassi();
  if (!syncError) return null;
  return (
    <View style={[styles.outer, style]}>
      <View testID="sync-error" style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.danger }]}>
        <Icon name="feedback" size={20} color={theme.danger} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: theme.danger }]}>Abgleich mit dem Server klappt nicht</Text>
          <Text selectable style={[styles.detail, { color: theme.muted }]}>
            {syncError}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingTop: space.gap },
  banner: { flexDirection: "row", gap: space.gap, padding: 10, borderWidth: 1, borderRadius: radius.tile },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: "600" },
  detail: { fontSize: 12 },
});
