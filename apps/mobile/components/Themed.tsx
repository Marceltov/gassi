// Text and View in the current color scheme's colors.
import { Text as DefaultText, type TextProps, View as DefaultView, type ViewProps } from "react-native";
import Colors from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

export function Text({ style, ...props }: TextProps) {
  return <DefaultText style={[{ color: Colors[useColorScheme()].text }, style]} {...props} />;
}

export function View({ style, ...props }: ViewProps) {
  return <DefaultView style={[{ backgroundColor: Colors[useColorScheme()].background }, style]} {...props} />;
}
