// The Start tab's stack: Start, the running walk, its summary after Zuhause, the training, an entry from the summary.
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "index" };

export default function StartLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
