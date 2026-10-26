// A page's scrolling part with pull to refresh (#122), on Android React Native's RefreshControl. PullScroll.web.tsx is
// the web's.
import type { ComponentProps } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useTheme } from "../theme";
import { usePull } from "./pull";

export function PullScroll(props: ComponentProps<typeof ScrollView>) {
  const theme = useTheme();
  const pull = usePull();
  const control = pull ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} colors={[theme.walk]} progressBackgroundColor={theme.surface} /> : undefined;
  return <ScrollView {...props} refreshControl={control} />;
}
