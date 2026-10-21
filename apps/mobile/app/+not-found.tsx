import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";

export default function NotFoundScreen() {
  const theme = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Nicht gefunden" }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.ink }]}>Diese Seite gibt es nicht.</Text>
        <Link href="/" style={[styles.link, { color: theme.walk }]}>
          Zum Start
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 20, fontWeight: "bold" },
  link: { marginTop: 15, paddingVertical: 15, fontSize: 14 },
});
