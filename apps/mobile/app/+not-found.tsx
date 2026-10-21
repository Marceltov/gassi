import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Nicht gefunden" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite gibt es nicht.</Text>
        <Link href="/" style={[styles.link, { color: Colors[useColorScheme()].tint }]}>
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
