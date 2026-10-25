// The app's version against its server's (#107), under the sync banner on every screen: restart once to get updates
// from the server signed in to; a new APK to install (or that it follows); or a server that is behind. Android only
// (updates.ts); the web app updates through its service worker.
import { Linking, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { type UpdateNotice, useUpdateNotice } from "../data/updates";
import { radius, space, useTheme } from "../theme";
import { Icon } from "./Icon";

const TEXT: Record<NonNullable<UpdateNotice>["kind"], string> = {
  restart: "Gassi einmal schließen und neu öffnen, damit es Updates von diesem Server bekommt.",
  older: "Neue Version installieren",
  newer: "Der Server ist noch nicht auf dem neuen Stand.",
};

/** `style`: the screen's sides. */
export function VersionBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const notice = useUpdateNotice();
  if (!notice) return null;
  const url = notice.kind === "older" ? notice.url : null;
  const line = (
    <View testID="version-notice" style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Icon name="feedback" size={20} color={theme.muted} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.ink }]}>{TEXT[notice.kind]}</Text>
        {notice.kind === "older" && !url ? <Text style={[styles.detail, { color: theme.muted }]}>Die neue Version folgt in Kürze.</Text> : null}
      </View>
    </View>
  );
  return <View style={[styles.outer, style]}>{url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>{line}</Pressable> : line}</View>;
}

const styles = StyleSheet.create({
  outer: { paddingTop: space.gap },
  banner: { flexDirection: "row", gap: space.gap, padding: 10, borderWidth: 1, borderRadius: radius.tile },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: "600" },
  detail: { fontSize: 12 },
});
