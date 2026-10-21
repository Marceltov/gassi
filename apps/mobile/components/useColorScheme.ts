import { useColorScheme as useColorSchemeCore } from "react-native";

/** "light" or "dark", following the device. */
export const useColorScheme = () => (useColorSchemeCore() === "dark" ? "dark" : "light");
