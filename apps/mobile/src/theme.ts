// The app's colors, sizes and the hook that picks light or dark.
import { useColorScheme } from "react-native";

const kinds = {
  walk: "#2e7d4f",
  food: "#8a5a1f",
  training: "#3b5ba5",
  pee: "#b08a16",
  poop: "#6b4a2b",
};

export const palettes = {
  dark: { ...kinds, neutral: "#2a2f37", background: "#111418", surface: "#1c2026", ink: "#e8eaed", muted: "#9aa0a6", line: "#2a2d33" },
  light: { ...kinds, neutral: "#dfe3e8", background: "#f3f4f6", surface: "#ffffff", ink: "#1b1f24", muted: "#5f6670", line: "#d5d9de" },
};

export type Palette = typeof palettes.dark;
export type ButtonKind = keyof typeof kinds | "neutral";

export const radius = { button: 20, tile: 12, sheet: 24 };
export const space = { gutter: 14, gap: 8 };

/** Follows the system; dark when the system says nothing. */
export function useTheme(): Palette {
  return useColorScheme() === "light" ? palettes.light : palettes.dark;
}
